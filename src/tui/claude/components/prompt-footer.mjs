/**
 * Prompt Footer Component
 *
 * Sits below the main prompt input. Shows contextual info like:
 * - Git branch and status
 * - Session name / resume command
 * - Context usage %
 */

import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import { execFileSync } from 'child_process'
import { CLAUDE_COLORS } from '../theme.mjs'

function getGitInfo() {
  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { stdio: 'pipe', timeout: 500 }).toString().trim()
    const status = execFileSync('git', ['status', '--porcelain'], { stdio: 'pipe', timeout: 1000 }).toString().trim()
    const modified = status.split('\n').filter(line => line.trim() !== '' && !line.startsWith('??')).length
    const untracked = status.split('\n').filter(line => line.startsWith('??')).length

    let statusText = ''
    if (modified > 0) statusText += ` +${modified}`
    if (untracked > 0) statusText += ` ?${untracked}`

    return { branch, status: statusText }
  } catch {
    return null
  }
}

export function PromptFooter({ session, prNumber, contextPercent, voiceMode }) {
  const [gitInfo, setGitInfo] = useState(null)

  useEffect(() => {
    setGitInfo(getGitInfo())
  }, [])

  const segments = []

  // Git info
  if (gitInfo) {
    segments.push(
      React.createElement(Text, { key: 'git', dimColor: true },
        'git:(',
        React.createElement(Text, { color: '#E8967E' }, gitInfo.branch),
        ')',
        gitInfo.status ? React.createElement(Text, { color: CLAUDE_COLORS.warning || 'yellow' }, gitInfo.status) : null
      )
    )
  }

  // Session info
  if (session?.name) {
    segments.push(React.createElement(Text, { key: 's', dimColor: true }, `session: ${session.name}`))
  } else if (session?.id) {
    segments.push(React.createElement(Text, { key: 's', dimColor: true }, `session: ${session.id.slice(0, 8)}`))
  }

  // PR Link
  if (prNumber) {
    segments.push(React.createElement(Text, { key: 'pr', dimColor: true }, `PR #${prNumber}`))
  }

  // Voice mode
  if (voiceMode) {
    segments.push(React.createElement(Text, { key: 'voice', color: '#E8967E' }, 'voice:on'))
  }

  // Context Usage
  if (contextPercent !== undefined && contextPercent > 0) {
    const color = contextPercent > 90 ? (CLAUDE_COLORS.error || 'red') : contextPercent > 70 ? (CLAUDE_COLORS.warning || 'yellow') : undefined
    segments.push(
      React.createElement(Text, { key: 'ctx', dimColor: !color, color }, `${contextPercent}% context`)
    )
  }

  if (segments.length === 0) return null

  // Join segments with dots
  const children = []
  segments.forEach((seg, i) => {
    children.push(seg)
    if (i < segments.length - 1) {
      children.push(React.createElement(Text, { key: `sep-${i}`, dimColor: true }, ' · '))
    }
  })

  return React.createElement(Box, { paddingLeft: 4 },
    ...children
  )
}
