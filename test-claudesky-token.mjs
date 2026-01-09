#!/usr/bin/env node
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'

// Load claudesky OAuth token
const configPath = '/Users/jkneen/Library/Application Support/claudesky/config.json'
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const token = config.oauthTokens.access

console.log('Claudesky token prefix:', token.substring(0, 20) + '...')
console.log('Token length:', token.length)
console.log('Expires:', new Date(config.oauthTokens.expires))
console.log('Expired:', Date.now() > config.oauthTokens.expires)

// Test with authToken (Bearer auth)
console.log('\nTesting with authToken (Bearer)...')
const client = new Anthropic({ authToken: token })

try {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: 'Say hello in one sentence.'
    }]
  })
  
  console.log('\n✅ SUCCESS with Bearer auth!')
  console.log('Response:', message.content[0].text)
} catch (error) {
  console.error('\n❌ FAILED with Bearer auth:', error.message)
}

// Test with apiKey (x-api-key header)
console.log('\nTesting with apiKey (x-api-key)...')
const client2 = new Anthropic({ apiKey: token })

try {
  const message = await client2.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: 'Say hello in one sentence.'
    }]
  })
  
  console.log('\n✅ SUCCESS with x-api-key!')
  console.log('Response:', message.content[0].text)
} catch (error) {
  console.error('\n❌ FAILED with x-api-key:', error.message)
}
