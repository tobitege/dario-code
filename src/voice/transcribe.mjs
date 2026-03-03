/**
 * Speech-to-text via Whisper API (Groq or OpenAI).
 * Uses native fetch + FormData — no npm deps.
 */

import { readFileSync } from 'fs'
import { basename } from 'path'
import { cleanup } from './recorder.mjs'

/**
 * Try to get an API key from the provider config (settings.json).
 * Falls back gracefully if provider modules aren't available.
 */
async function getProviderApiKey(providerId) {
  try {
    const { getEnabledProviders } = await import('../providers/config.mjs')
    const providers = getEnabledProviders()
    const match = providers.find(p => p.id === providerId)
    return match?.apiKey || null
  } catch {
    return null
  }
}

/**
 * Resolve which STT provider to use.
 * Checks env vars first, then provider config (settings.json).
 * @returns {{ url: string, key: string, model: string, name: string } | null}
 */
export function resolveProvider() {
  // Groq: env var
  const groqKey = process.env.GROQ_API_KEY
  if (groqKey) {
    return {
      url: 'https://api.groq.com/openai/v1/audio/transcriptions',
      key: groqKey,
      model: 'whisper-large-v3-turbo',
      name: 'Groq',
    }
  }

  // OpenAI: env var
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    return {
      url: 'https://api.openai.com/v1/audio/transcriptions',
      key: openaiKey,
      model: 'whisper-1',
      name: 'OpenAI',
    }
  }

  return null
}

/**
 * Async version that also checks provider config.
 * @returns {Promise<{ url: string, key: string, model: string, name: string } | null>}
 */
export async function resolveProviderAsync() {
  // Try sync (env vars) first
  const sync = resolveProvider()
  if (sync) return sync

  // Try provider config for Groq
  const groqConfigKey = await getProviderApiKey('groq')
  if (groqConfigKey) {
    return {
      url: 'https://api.groq.com/openai/v1/audio/transcriptions',
      key: groqConfigKey,
      model: 'whisper-large-v3-turbo',
      name: 'Groq',
    }
  }

  // Try provider config for OpenAI
  const openaiConfigKey = await getProviderApiKey('openai')
  if (openaiConfigKey) {
    return {
      url: 'https://api.openai.com/v1/audio/transcriptions',
      key: openaiConfigKey,
      model: 'whisper-1',
      name: 'OpenAI',
    }
  }

  return null
}

/**
 * Transcribe a WAV file to text via Whisper.
 * Cleans up the temp file after transcription.
 * @param {string} wavPath - Path to the WAV file.
 * @returns {Promise<string>} Transcribed text.
 */
export async function transcribe(wavPath) {
  const provider = await resolveProviderAsync()
  if (!provider) {
    cleanup(wavPath)
    throw new Error(
      'No STT API key found. Set GROQ_API_KEY (recommended) or OPENAI_API_KEY.\n' +
      '  Groq: https://console.groq.com/keys\n' +
      '  OpenAI: https://platform.openai.com/api-keys'
    )
  }

  try {
    const fileBuffer = readFileSync(wavPath)
    const blob = new Blob([fileBuffer], { type: 'audio/wav' })

    const form = new FormData()
    form.append('file', blob, basename(wavPath))
    form.append('model', provider.model)

    const res = await fetch(provider.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${provider.key}` },
      body: form,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`${provider.name} Whisper API error (${res.status}): ${body}`)
    }

    const data = await res.json()
    return (data.text || '').trim()
  } finally {
    cleanup(wavPath)
  }
}
