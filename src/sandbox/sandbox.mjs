/**
 * Sandbox Mode for OpenClaude
 *
 * Implements bash command sandboxing using macOS sandbox-exec for security.
 * Provides permission boundaries and escape detection.
 */

import { execSync, spawnSync } from 'child_process'
import { homedir } from 'os'
import { platform } from 'os'
import path from 'path'
import fs from 'fs'

/**
 * Check if the current platform supports sandboxing
 * Currently only macOS supports sandbox-exec
 */
export function isSandboxSupported() {
  return platform() === 'darwin'
}

/**
 * Patterns that indicate an attempt to escape the sandbox
 */
const ESCAPE_PATTERNS = [
  /sandbox-exec\s+-p/i,           // Trying to run sandbox-exec
  /rhino\s+sandbox/i,              // macOS Rhino sandbox escaping
  /\.dylib.*inject/i,              // Injecting libraries
  /ptrace|dtrace|strace/i,         // Debugger/tracer bypass attempts
  /launchctl\s+load/i,             // Loading launch agents/daemons
  /kextload|kextunload/i,          // Kernel extension manipulation
  /sudo\s+sandbox-exec/i,          // Trying to elevate sandbox
  /codesign.*-R/i,                 // Code signature removal attempts
  /otool|install_name_tool/i,      // Mach-O manipulation
  /nvram|bless/i,                  // Boot parameter manipulation
  /_JAVA_TOOL_OPTIONS|LD_PRELOAD/i, // Environment-based injection
  /dmesg|sysctl.*kern\.sysv/i,    // System parameter manipulation
]

/**
 * Detect if a command contains patterns that indicate sandbox escape attempts
 */
export function detectEscapeAttempt(command) {
  for (const pattern of ESCAPE_PATTERNS) {
    if (pattern.test(command)) {
      return {
        detected: true,
        pattern: pattern.source,
        message: `Potential sandbox escape detected: ${pattern.source}`
      }
    }
  }

  return {
    detected: false,
    pattern: null,
    message: null
  }
}

/**
 * Generate a macOS sandbox-exec profile based on options
 *
 * Profile restrictions:
 * - File reads: allowed everywhere (except sensitive system paths)
 * - File writes: restricted to project dir and /tmp
 * - Network: allowed (unless disabled in options)
 * - Process execution: allowed but limited
 */
export function createSandboxProfile(options = {}) {
  const {
    projectDir = process.cwd(),
    allowNetwork = true,
    readOnlyPaths = [],
    writePaths = ['/tmp', projectDir],
    denyPaths = [
      process.env.HOME ? path.join(process.env.HOME, '.ssh') : '',
      process.env.HOME ? path.join(process.env.HOME, '.aws') : '',
      process.env.HOME ? path.join(process.env.HOME, '.kube') : '',
      process.env.HOME ? path.join(process.env.HOME, '.git-credentials') : '',
    ].filter(Boolean),
    allowProcessExec = true,
    allowSubprocesses = true
  } = options

  // Normalize paths
  const normalizedWritePaths = writePaths
    .filter(Boolean)
    .map(p => p.replace(/"/g, '\\"'))

  const normalizedDenyPaths = denyPaths
    .filter(Boolean)
    .map(p => p.replace(/"/g, '\\"'))

  const normalizedReadOnlyPaths = readOnlyPaths
    .filter(Boolean)
    .map(p => p.replace(/"/g, '\\"'))

  // Build profile rules
  const rules = [
    '(version 1)',
    '(deny default)',
    '',
    '; Allow necessary file operations',
    '(allow file-read*)',
    '(allow file-write* (subpath "/tmp"))',
    '(allow file-write* (subpath "/var/tmp"))',
  ]

  // Add write paths
  for (const writePath of normalizedWritePaths) {
    if (writePath) {
      rules.push(`(allow file-write* (subpath "${writePath}"))`)
    }
  }

  // Deny sensitive paths
  for (const denyPath of normalizedDenyPaths) {
    if (denyPath) {
      rules.push(`(deny file-read* (subpath "${denyPath}"))`)
      rules.push(`(deny file-write* (subpath "${denyPath}"))`)
    }
  }

  // Network access
  if (allowNetwork) {
    rules.push('')
    rules.push('; Allow network access')
    rules.push('(allow network-outbound)')
    rules.push('(allow network-inbound)')
  }

  // Process execution
  if (allowProcessExec) {
    rules.push('')
    rules.push('; Allow process execution')
    rules.push('(allow process-exec)')
    rules.push('(allow process-fork)')
  }

  // System operations
  rules.push('')
  rules.push('; Allow necessary system operations')
  rules.push('(allow sysctl-read)')
  rules.push('(allow iokit-get-properties)')
  rules.push('(allow mach-lookup)')
  rules.push('(allow unix-socket-open)')

  // Signal handling
  rules.push('')
  rules.push('; Allow signal operations')
  rules.push('(allow signal (target self))')

  return rules.join('\n')
}

/**
 * Write sandbox profile to a temporary file and return the path
 */
export function writeSandboxProfile(profile) {
  const tmpDir = '/tmp'
  const timestamp = Date.now()
  const profilePath = path.join(tmpDir, `.sandbox-profile-${process.pid}-${timestamp}.sb`)

  try {
    fs.writeFileSync(profilePath, profile, { mode: 0o600 })
    return profilePath
  } catch (error) {
    throw new Error(`Failed to write sandbox profile: ${error.message}`)
  }
}

/**
 * Clean up a temporary sandbox profile
 */
export function deleteSandboxProfile(profilePath) {
  try {
    if (fs.existsSync(profilePath)) {
      fs.unlinkSync(profilePath)
    }
  } catch (error) {
    // Silently ignore cleanup errors
  }
}

/**
 * Wrap a command with sandbox-exec
 *
 * Returns the wrapped command string or null if sandboxing not supported
 */
export function wrapCommand(command, profilePath) {
  if (!isSandboxSupported()) {
    return null
  }

  if (!profilePath || !fs.existsSync(profilePath)) {
    return null
  }

  // Escape single quotes in the command for shell safety
  const escapedCommand = command.replace(/'/g, "'\\''")

  return `sandbox-exec -f "${profilePath}" sh -c '${escapedCommand}'`
}

/**
 * Get sandbox settings from configuration
 */
export function getSandboxSettings(configLoader) {
  try {
    // Load from config if configLoader provided
    if (configLoader && typeof configLoader.loadSettings === 'function') {
      const settings = configLoader.loadSettings()
      return settings.sandbox || {}
    }
  } catch (error) {
    // Ignore errors reading config
  }

  return {}
}

/**
 * Apply sandbox settings to options
 */
export function applySandboxSettings(options = {}, settings = {}) {
  const {
    enabled = settings.enabled ?? true,
    allowUnsandboxedCommands = settings.allowUnsandboxedCommands ?? false,
    allowNetwork = settings.allowNetwork ?? true,
    projectDir = process.cwd(),
    readOnlyPaths = settings.readOnlyPaths ?? [],
    writePaths = settings.writePaths ?? ['/tmp', projectDir],
    allowProcessExec = settings.allowProcessExec ?? true
  } = { ...settings, ...options }

  return {
    enabled,
    allowUnsandboxedCommands,
    allowNetwork,
    projectDir,
    readOnlyPaths,
    writePaths,
    allowProcessExec
  }
}

/**
 * Execute a command with optional sandboxing
 *
 * Returns object with stdout, stderr, code, and sandboxed flag
 */
export function executeWithSandbox(command, options = {}) {
  const settings = applySandboxSettings({}, options)

  // Check for escape attempts first
  const escapeCheck = detectEscapeAttempt(command)
  if (escapeCheck.detected) {
    return {
      stdout: '',
      stderr: `Error: ${escapeCheck.message}`,
      code: 1,
      sandboxed: false,
      escaped: true
    }
  }

  // If sandboxing not supported or disabled, run unsandboxed
  if (!isSandboxSupported() || !settings.enabled) {
    try {
      const result = spawnSync('sh', ['-c', command], {
        encoding: 'utf8',
        timeout: 120000,
        shell: true
      })

      return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        code: result.status || 0,
        sandboxed: false,
        escaped: false
      }
    } catch (error) {
      return {
        stdout: '',
        stderr: error.message,
        code: 1,
        sandboxed: false,
        escaped: false
      }
    }
  }

  // Create and use sandbox profile
  const profile = createSandboxProfile({
    projectDir: settings.projectDir,
    allowNetwork: settings.allowNetwork,
    readOnlyPaths: settings.readOnlyPaths,
    writePaths: settings.writePaths,
    allowProcessExec: settings.allowProcessExec
  })

  let profilePath = null

  try {
    profilePath = writeSandboxProfile(profile)
    const wrappedCommand = wrapCommand(command, profilePath)

    if (!wrappedCommand) {
      throw new Error('Failed to wrap command with sandbox')
    }

    const result = spawnSync('sh', ['-c', wrappedCommand], {
      encoding: 'utf8',
      timeout: 120000,
      shell: false
    })

    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      code: result.status || 0,
      sandboxed: true,
      escaped: false
    }
  } catch (error) {
    return {
      stdout: '',
      stderr: error.message,
      code: 1,
      sandboxed: false,
      escaped: false
    }
  } finally {
    // Clean up profile file
    if (profilePath) {
      deleteSandboxProfile(profilePath)
    }
  }
}

/**
 * Check if a command is in the unsandboxed allowlist
 */
export function isInAllowlist(command, allowlist = []) {
  const cmdName = command.split(/\s+/)[0]

  for (const allowed of allowlist) {
    if (typeof allowed === 'string') {
      if (cmdName === allowed || cmdName.endsWith(`/${allowed}`)) {
        return true
      }
    } else if (allowed instanceof RegExp) {
      if (allowed.test(cmdName)) {
        return true
      }
    }
  }

  return false
}

/**
 * Export all sandbox functionality
 */
export default {
  isSandboxSupported,
  detectEscapeAttempt,
  createSandboxProfile,
  writeSandboxProfile,
  deleteSandboxProfile,
  wrapCommand,
  getSandboxSettings,
  applySandboxSettings,
  executeWithSandbox,
  isInAllowlist
}
