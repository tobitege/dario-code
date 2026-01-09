/**
 * CLI Initialization Functions
 *
 * Handles all initialization checks and setup for the CLI.
 * Validates environment, permissions, and configuration.
 *
 */

import { homedir } from 'os';
import semver from 'semver';

/**
 * Main initialization function
 *
 * Performs critical startup checks:
 * 1. Node.js version validation (>= 18.0.0)
 * 2. Root/sudo privilege detection and warning
 * 3. Docker environment detection
 * 4. Internet access validation
 * 5. iTerm2 key binding installation
 * 6. Auto-updater configuration
 * 7. Configuration migration
 *
 * @param {string} cwd - Current working directory
 * @param {boolean} skipPermissions - Whether to skip permission checks
 * @returns {Promise<void>}
 * @throws {Error} If critical initialization fails
 */
export async function initialize(cwd, skipPermissions = false) {
  // Check Node.js version
  const nodeVersion = process.version;
  const minVersion = '18.0.0';

  if (!semver.satisfies(nodeVersion, `>=${minVersion}`)) {
    throw new Error(
      `Node.js ${minVersion} or higher is required. Current version: ${nodeVersion}\n` +
      `Please upgrade Node.js: https://nodejs.org/`
    );
  }

  // Check for root/sudo privileges
  if (process.getuid && process.getuid() === 0) {
    console.warn(
      '⚠️  WARNING: Running as root/sudo is not recommended.\n' +
      'This may cause permission issues with config files.\n' +
      'Please run without sudo/root privileges.\n'
    );
  }

  // Detect Docker environment
  const isDocker = await isRunningInDocker();
  if (isDocker && !skipPermissions) {
    console.warn(
      '⚠️  Docker environment detected.\n' +
      'Some features may be limited. Use --dangerously-skip-permissions to bypass.\n'
    );
  }

  // Validate internet access
  if (!skipPermissions) {
    const hasInternet = await checkInternetAccess();
    if (!hasInternet) {
      console.warn(
        '⚠️  No internet connection detected.\n' +
        'Some features require internet access.\n'
      );
    }
  }

  // Install iTerm2 key bindings (macOS only)
  if (process.platform === 'darwin') {
    await installITerm2KeyBindings();
  }

  // Configure auto-updater
  await configureAutoUpdater();

  // Migrate legacy configuration if needed
  await migrateConfiguration();

  // Set current working directory
  await setWorkingDirectory(cwd);
}

/**
 * Detects if running inside a Docker container
 *
 * Checks for Docker-specific files and environment variables:
 * - /.dockerenv file
 * - /proc/1/cgroup containing "docker"
 * - DOCKER environment variable
 *
 * @returns {Promise<boolean>} True if running in Docker
 */
async function isRunningInDocker() {
  try {
    const fs = await import('fs');

    // Check for /.dockerenv
    if (fs.existsSync('/.dockerenv')) {
      return true;
    }

    // Check /proc/1/cgroup
    if (fs.existsSync('/proc/1/cgroup')) {
      const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8');
      if (cgroup.includes('docker')) {
        return true;
      }
    }

    // Check environment variable
    if (process.env.DOCKER) {
      return true;
    }

    return false;
  } catch (error) {
    // Assume not Docker if checks fail
    return false;
  }
}

/**
 * Checks for internet connectivity
 *
 * Attempts to resolve DNS for anthropic.com
 *
 * @returns {Promise<boolean>} True if internet is accessible
 */
async function checkInternetAccess() {
  try {
    const dns = await import('dns');
    const { promisify } = await import('util');
    const lookup = promisify(dns.lookup);

    await lookup('anthropic.com');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Installs iTerm2 key bindings for better terminal integration
 *
 * Adds custom key mappings for:
 * - Option+Left/Right for word navigation
 * - Cmd+Backspace for line deletion
 *
 * @returns {Promise<void>}
 */
async function installITerm2KeyBindings() {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Check if iTerm2 is installed
    const { stdout } = await execAsync('mdfind "kMDItemCFBundleIdentifier == \'com.googlecode.iterm2\'"');

    if (stdout.trim()) {
      // iTerm2 is installed, configure key bindings
      // Implementation would go here
    }
  } catch (error) {
    // Silent fail - not critical
  }
}

/**
 * Configures the auto-updater system
 *
 * Sets up automatic update checks and installation
 *
 * @returns {Promise<void>}
 */
async function configureAutoUpdater() {
  const config = loadConfig();

  if (!config.autoUpdaterConfigured) {
    // First-time setup
    const updatedConfig = {
      ...config,
      autoUpdaterConfigured: true,
      autoUpdateEnabled: true,
      lastUpdateCheck: Date.now()
    };

    saveConfig(updatedConfig);
  }
}

/**
 * Migrates configuration from older versions
 *
 * Handles breaking changes between versions:
 * - Renames old config keys
 * - Updates data formats
 * - Removes deprecated settings
 *
 * @returns {Promise<void>}
 */
async function migrateConfiguration() {
  const config = loadConfig();
  let needsSave = false;

  // Example migration: rename old key
  if (config.oldKeyName !== undefined) {
    config.newKeyName = config.oldKeyName;
    delete config.oldKeyName;
    needsSave = true;
  }

  // Add config version if missing
  if (!config.version) {
    config.version = '1.0.0';
    needsSave = true;
  }

  if (needsSave) {
    saveConfig(config);
  }
}

/**
 * Sets and validates the working directory
 *
 * @param {string} cwd - Current working directory to set
 * @returns {Promise<void>}
 * @throws {Error} If directory doesn't exist or isn't accessible
 */
async function setWorkingDirectory(cwd) {
  const fs = await import('fs');

  if (!fs.existsSync(cwd)) {
    throw new Error(`Directory does not exist: ${cwd}`);
  }

  const stats = fs.statSync(cwd);
  if (!stats.isDirectory()) {
    throw new Error(`Not a directory: ${cwd}`);
  }

  process.chdir(cwd);
}

// Placeholder functions
function loadConfig() {
  throw new Error('Not implemented - see src/config/index.mjs');
}

function saveConfig() {
  throw new Error('Not implemented - see src/config/index.mjs');
}
