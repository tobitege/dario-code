/**
 * Plugin loader and lifecycle management
 * Loads, initializes, and manages plugins
 */

import path from 'path'
import fs from 'fs'
import { fileExists, readFile, safeJsonParse } from '../core/utils.mjs'
import { loadPluginManifest, getPluginDir, getEnabledPlugins } from './registry.mjs'
import { validateManifest } from './manifest.mjs'

/**
 * Load a single plugin
 */
export async function loadPlugin(pluginName) {
  const pluginDir = getPluginDir(pluginName)

  if (!fileExists(pluginDir)) {
    throw new Error(`Plugin directory not found: ${pluginDir}`)
  }

  // Load manifest
  const manifest = loadPluginManifest(pluginName)
  if (!manifest) {
    throw new Error(`Plugin manifest not found for ${pluginName}`)
  }

  // Validate manifest
  const validation = validateManifest(manifest)
  if (!validation.valid) {
    throw new Error(`Invalid plugin manifest for ${pluginName}: ${validation.errors.join(', ')}`)
  }

  // Load entry point
  const entryPath = path.join(pluginDir, manifest.entry || 'index.mjs')
  if (!fileExists(entryPath)) {
    throw new Error(`Plugin entry point not found: ${entryPath}`)
  }

  let pluginModule
  try {
    pluginModule = await import(`file://${entryPath}`)
  } catch (e) {
    throw new Error(`Failed to load plugin ${pluginName}: ${e.message}`)
  }

  return {
    name: pluginName,
    manifest,
    module: pluginModule,
    dir: pluginDir,
    enabled: false,
    initialized: false
  }
}

/**
 * Initialize a loaded plugin
 */
export async function initializePlugin(plugin) {
  if (plugin.initialized) {
    return plugin
  }

  // Call init hook if it exists
  if (plugin.module.init && typeof plugin.module.init === 'function') {
    try {
      await plugin.module.init(plugin)
    } catch (e) {
      throw new Error(`Failed to initialize plugin ${plugin.name}: ${e.message}`)
    }
  }

  plugin.initialized = true
  plugin.enabled = true

  return plugin
}

/**
 * Enable a loaded plugin
 */
export async function enablePlugin(plugin) {
  if (plugin.enabled) {
    return plugin
  }

  // Call enable hook if it exists
  if (plugin.module.onEnable && typeof plugin.module.onEnable === 'function') {
    try {
      await plugin.module.onEnable(plugin)
    } catch (e) {
      throw new Error(`Failed to enable plugin ${plugin.name}: ${e.message}`)
    }
  }

  plugin.enabled = true
  return plugin
}

/**
 * Disable a loaded plugin
 */
export async function disablePlugin(plugin) {
  if (!plugin.enabled) {
    return plugin
  }

  // Call disable hook if it exists
  if (plugin.module.onDisable && typeof plugin.module.onDisable === 'function') {
    try {
      await plugin.module.onDisable(plugin)
    } catch (e) {
      throw new Error(`Failed to disable plugin ${plugin.name}: ${e.message}`)
    }
  }

  plugin.enabled = false
  return plugin
}

/**
 * Unload a plugin
 */
export async function unloadPlugin(plugin) {
  // Disable first if enabled
  if (plugin.enabled) {
    await disablePlugin(plugin)
  }

  // Call unload hook if it exists
  if (plugin.module.onUnload && typeof plugin.module.onUnload === 'function') {
    try {
      await plugin.module.onUnload(plugin)
    } catch (e) {
      throw new Error(`Failed to unload plugin ${plugin.name}: ${e.message}`)
    }
  }

  plugin.initialized = false
  return plugin
}

/**
 * Load all enabled plugins
 */
export async function loadEnabledPlugins() {
  const enabledPlugins = getEnabledPlugins()
  const loadedPlugins = []
  const errors = []

  for (const pluginName of enabledPlugins) {
    try {
      const plugin = await loadPlugin(pluginName)
      await initializePlugin(plugin)
      loadedPlugins.push(plugin)
    } catch (e) {
      errors.push({
        plugin: pluginName,
        error: e.message
      })
    }
  }

  return {
    plugins: loadedPlugins,
    errors
  }
}

/**
 * Collect commands from all plugins
 */
export function collectPluginCommands(plugins) {
  const commands = {}

  for (const plugin of plugins) {
    if (plugin.manifest.commands && Array.isArray(plugin.manifest.commands)) {
      for (const command of plugin.manifest.commands) {
        const cmdName = command.name || command.id
        commands[cmdName] = {
          ...command,
          plugin: plugin.name,
          handler: plugin.module[command.handler] || null
        }
      }
    }
  }

  return commands
}

/**
 * Collect tools from all plugins
 */
export function collectPluginTools(plugins) {
  const tools = []

  for (const plugin of plugins) {
    if (plugin.manifest.tools && Array.isArray(plugin.manifest.tools)) {
      for (const tool of plugin.manifest.tools) {
        tools.push({
          ...tool,
          plugin: plugin.name,
          handler: plugin.module[tool.handler] || null
        })
      }
    }
  }

  return tools
}

export default {
  loadPlugin,
  initializePlugin,
  enablePlugin,
  disablePlugin,
  unloadPlugin,
  loadEnabledPlugins,
  collectPluginCommands,
  collectPluginTools
}
