/**
 * Plugin installer - handles plugin installation from npm and local sources
 */

import path from 'path'
import fs from 'fs'
import os from 'os'
import { execSync, spawn } from 'child_process'
import { fileExists, writeFile, readFile } from '../core/utils.mjs'
import { registerPlugin } from './registry.mjs'
import { getPluginsDir, getPluginDir } from './registry.mjs'
import { validateManifest } from './manifest.mjs'

const TEMP_DIR = path.join(os.tmpdir(), 'openclaude-plugins')

/**
 * Install a plugin from npm registry
 */
export async function installFromNpm(pluginName) {
  const pluginDir = getPluginDir(pluginName)

  // Create plugins directory if it doesn't exist
  const pluginsDir = getPluginsDir()
  if (!fileExists(pluginsDir)) {
    fs.mkdirSync(pluginsDir, { recursive: true })
  }

  // Create temp directory
  if (!fileExists(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true })
  }

  try {
    // Install to temp location first
    const tempPluginDir = path.join(TEMP_DIR, pluginName)
    if (fileExists(tempPluginDir)) {
      fs.rmSync(tempPluginDir, { recursive: true })
    }
    fs.mkdirSync(tempPluginDir, { recursive: true })

    // Use npm to install the package
    const cmd = `npm install --prefix "${tempPluginDir}" "${pluginName}@latest"`
    execSync(cmd, { stdio: 'pipe' })

    // Verify manifest exists
    const manifestPath = path.join(tempPluginDir, 'node_modules', pluginName, 'manifest.json')
    if (!fileExists(manifestPath)) {
      throw new Error(`Plugin does not have a manifest.json file`)
    }

    // Validate manifest
    const manifestContent = readFile(manifestPath)
    const manifest = JSON.parse(manifestContent)
    const validation = validateManifest(manifest)
    if (!validation.valid) {
      throw new Error(`Invalid manifest: ${validation.errors.join(', ')}`)
    }

    // Move to final location
    if (fileExists(pluginDir)) {
      fs.rmSync(pluginDir, { recursive: true })
    }
    fs.mkdirSync(pluginDir, { recursive: true })

    // Copy plugin files
    const sourceDir = path.join(tempPluginDir, 'node_modules', pluginName)
    const files = fs.readdirSync(sourceDir)
    for (const file of files) {
      const src = path.join(sourceDir, file)
      const dest = path.join(pluginDir, file)
      if (fs.statSync(src).isDirectory()) {
        fs.cpSync(src, dest, { recursive: true })
      } else {
        fs.copyFileSync(src, dest)
      }
    }

    // Clean up temp
    if (fileExists(tempPluginDir)) {
      fs.rmSync(tempPluginDir, { recursive: true })
    }

    // Register the plugin
    registerPlugin(pluginName)

    return {
      success: true,
      name: pluginName,
      version: manifest.version,
      path: pluginDir
    }
  } catch (e) {
    // Clean up on failure
    if (fileExists(pluginDir)) {
      fs.rmSync(pluginDir, { recursive: true })
    }
    throw new Error(`Failed to install plugin from npm: ${e.message}`)
  }
}

/**
 * Install a plugin from a local directory
 */
export async function installFromLocal(sourcePath) {
  // Verify source exists
  if (!fileExists(sourcePath)) {
    throw new Error(`Source path does not exist: ${sourcePath}`)
  }

  // Load and validate manifest
  const manifestPath = path.join(sourcePath, 'manifest.json')
  if (!fileExists(manifestPath)) {
    throw new Error(`No manifest.json found in ${sourcePath}`)
  }

  const manifestContent = readFile(manifestPath)
  const manifest = JSON.parse(manifestContent)

  const validation = validateManifest(manifest)
  if (!validation.valid) {
    throw new Error(`Invalid manifest: ${validation.errors.join(', ')}`)
  }

  const pluginName = manifest.name
  const pluginDir = getPluginDir(pluginName)

  try {
    // Create plugins directory if needed
    const pluginsDir = getPluginsDir()
    if (!fileExists(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true })
    }

    // Copy plugin to plugins directory
    if (fileExists(pluginDir)) {
      fs.rmSync(pluginDir, { recursive: true })
    }
    fs.mkdirSync(pluginDir, { recursive: true })

    // Copy all files
    const files = fs.readdirSync(sourcePath)
    for (const file of files) {
      // Skip node_modules and hidden files
      if (file === 'node_modules' || file.startsWith('.')) {
        continue
      }

      const src = path.join(sourcePath, file)
      const dest = path.join(pluginDir, file)

      if (fs.statSync(src).isDirectory()) {
        fs.cpSync(src, dest, { recursive: true })
      } else {
        fs.copyFileSync(src, dest)
      }
    }

    // Register the plugin
    registerPlugin(pluginName)

    return {
      success: true,
      name: pluginName,
      version: manifest.version,
      path: pluginDir
    }
  } catch (e) {
    // Clean up on failure
    if (fileExists(pluginDir)) {
      fs.rmSync(pluginDir, { recursive: true })
    }
    throw new Error(`Failed to install plugin from local: ${e.message}`)
  }
}

/**
 * Uninstall a plugin
 */
export async function uninstallPlugin(pluginName) {
  const pluginDir = getPluginDir(pluginName)

  if (!fileExists(pluginDir)) {
    throw new Error(`Plugin not found: ${pluginName}`)
  }

  try {
    fs.rmSync(pluginDir, { recursive: true })
    return {
      success: true,
      name: pluginName
    }
  } catch (e) {
    throw new Error(`Failed to uninstall plugin: ${e.message}`)
  }
}

/**
 * Update a plugin
 */
export async function updatePlugin(pluginName) {
  // For now, uninstall and reinstall
  await uninstallPlugin(pluginName)
  return await installFromNpm(pluginName)
}

export default {
  installFromNpm,
  installFromLocal,
  uninstallPlugin,
  updatePlugin
}
