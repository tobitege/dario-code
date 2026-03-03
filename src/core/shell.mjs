import fs from 'fs'
import os from 'os'
import path from 'path'

function firstExistingPath(paths) {
  for (const candidate of paths) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

function getWindowsShell() {
  const gitBashCandidates = [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Git', 'bin', 'bash.exe')
  ]
  if (process.env.LocalAppData) {
    gitBashCandidates.push(path.join(process.env.LocalAppData, 'Programs', 'Git', 'bin', 'bash.exe'))
  }

  const gitBashPath = firstExistingPath(gitBashCandidates)
  if (gitBashPath) {
    return {
      command: gitBashPath,
      args: ['-lc'],
      name: 'bash'
    }
  }

  return {
    command: process.env.ComSpec || 'cmd.exe',
    args: ['/d', '/s', '/c'],
    name: 'cmd'
  }
}

export function getShellCommand() {
  if (os.platform() === 'win32') {
    return getWindowsShell()
  }

  return {
    command: process.env.SHELL || 'sh',
    args: ['-c'],
    name: 'sh'
  }
}

export function buildShellSpawn(command) {
  const shell = getShellCommand()
  return {
    command: shell.command,
    args: [...shell.args, command],
    shellName: shell.name
  }
}
