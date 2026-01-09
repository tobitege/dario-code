/**
 * Fast Mode Toggle Component
 *
 * Renders the /fast overlay panel:
 * * - ↯ Fast mode title
 * - ON/OFF toggle via Tab
 * - Enter to confirm, Esc to cancel
 */

import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import { CLAUDE_COLORS } from '../theme.mjs'
import { isFastMode, getFastModeDisplayName } from '../../../core/config.mjs'

const FAST_ICON = '↯'
const PENGUIN_COLOR = '#d4a574' // warm orange/gold

/**
 * Fast mode toggle overlay
 * @param {Object} props
 * @param {Function} props.onConfirm - Called with {enabled: boolean} when user confirms
 * @param {Function} props.onCancel - Called when user presses Esc
 */
export function FastModeToggle({ onConfirm, onCancel }) {
  const [enabled, setEnabled] = useState(isFastMode())
  const modelName = getFastModeDisplayName()

  const toggle = useCallback(() => {
    setEnabled(prev => !prev)
  }, [])

  useInput((input, key) => {
    if (key.tab || input === ' ') {
      toggle()
    } else if (key.return) {
      onConfirm({ enabled })
    } else if (key.escape) {
      onCancel()
    }
  })

  return React.createElement(Box, {
    flexDirection: 'column',
    borderStyle: 'round',
    borderColor: PENGUIN_COLOR,
    paddingX: 1,
    paddingY: 0,
    marginTop: 1,
    width: 80,
  },
    // Title
    React.createElement(Box, { marginBottom: 0 },
      React.createElement(Text, { color: PENGUIN_COLOR, bold: true },
        ` ${FAST_ICON} Fast mode`
      )
    ),

    // Subtitle
    React.createElement(Box, { marginBottom: 1 },
      React.createElement(Text, { dimColor: true },
        ` High-speed mode for ${modelName}. Billed as extra usage at a premium rate. Separate rate limits apply.`
      )
    ),

    // Toggle row
    React.createElement(Box, { marginLeft: 3, marginBottom: 1 },
      React.createElement(Text, { bold: true }, 'Fast mode'),
      React.createElement(Text, null, '  '),
      React.createElement(Text, {
        color: enabled ? PENGUIN_COLOR : undefined,
        bold: enabled,
      }, enabled ? 'ON ' : 'OFF'),
    ),

    // Learn more link
    React.createElement(Box, { marginBottom: 1 },
      React.createElement(Text, { dimColor: true },
        ` Learn more: https://code.claude.com/docs/en/fast-mode`
      )
    ),

    // Controls hint
    React.createElement(Box, null,
      React.createElement(Text, { dimColor: true, italic: true },
        ` Tab to toggle · Enter to confirm · Esc to cancel`
      )
    ),
  )
}

export default FastModeToggle
