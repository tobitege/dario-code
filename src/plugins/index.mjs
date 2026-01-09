/**
 * Plugin system entry point
 * Exports all plugin-related functionality
 */

// Manifest
export * from './manifest.mjs'

// Registry (plugin name-based operations)
export {
  loadRegistry,
  saveRegistry,
  registerPlugin,
  unregisterPlugin,
  isPluginEnabled,
  isPluginRegistered,
  getEnabledPlugins,
  getRegisteredPlugins,
  getPluginStatus,
  loadPluginManifest,
  savePluginManifest,
  getPluginsDir,
  getPluginDir,
  // Registry-specific enable/disable (by name)
  enablePlugin as enablePluginByName,
  disablePlugin as disablePluginByName
} from './registry.mjs'

// Loader (plugin object-based operations)
export {
  loadPlugin,
  initializePlugin,
  unloadPlugin,
  loadEnabledPlugins,
  collectPluginCommands,
  collectPluginTools,
  // Loader-specific enable/disable (by plugin object)
  enablePlugin,
  disablePlugin
} from './loader.mjs'

// Installer
export * from './installer.mjs'

// Default module exports
export { default as manifestModule } from './manifest.mjs'
export { default as registryModule } from './registry.mjs'
export { default as loaderModule } from './loader.mjs'
export { default as installerModule } from './installer.mjs'
