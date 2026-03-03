/**
 * Microphone recording via sox child process.
 * Records 16kHz mono WAV suitable for Whisper STT.
 */

import { spawn, execFileSync } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { unlinkSync, existsSync } from 'fs'

let recProcess = null
let currentFile = null

/**
 * Check if sox/rec is installed and available.
 * @returns {boolean}
 */
export function isAvailable() {
  try {
    execFileSync('which', ['rec'], { stdio: 'pipe', timeout: 2000 })
    return true
  } catch {
    return false
  }
}

/**
 * Start recording from the default microphone.
 * @returns {string} Path to the WAV file being written.
 */
export function startRecording() {
  if (recProcess) throw new Error('Already recording')

  const wavPath = join(tmpdir(), `dario-voice-${Date.now()}.wav`)
  currentFile = wavPath

  recProcess = spawn('rec', ['-q', '-r', '16000', '-c', '1', '-b', '16', '-t', 'wav', wavPath], {
    stdio: 'ignore',
  })

  recProcess.on('error', (err) => {
    recProcess = null
    currentFile = null
  })

  return wavPath
}

/**
 * Stop recording and return the WAV file path.
 * @returns {string} Path to the recorded WAV file.
 */
export function stopRecording() {
  if (!recProcess) throw new Error('Not recording')

  const wavPath = currentFile
  recProcess.kill('SIGTERM')
  recProcess = null
  currentFile = null
  return wavPath
}

/**
 * Clean up a temporary WAV file.
 * @param {string} wavPath
 */
export function cleanup(wavPath) {
  try {
    if (wavPath && existsSync(wavPath)) unlinkSync(wavPath)
  } catch {
    // best-effort cleanup
  }
}
