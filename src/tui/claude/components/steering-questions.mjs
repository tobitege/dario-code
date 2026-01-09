/**
 * SteeringQuestions - Multi-tab interactive question overlay
 *
 * Presents tabbed questions with single/multi-select options,
 * custom text input, and a submit review tab.
 *
 * Follows the same overlay pattern as ModelSelector, ContextManager, etc:
 *   - Outer Box with borderStyle: 'round', borderColor: THEME.claude
 *   - ⏺ title in claude color
 *   - ' → ' selection indicator with inverse
 *   - dimColor descriptions and footer hints
 *
 * Props:
 *   questions - Array<{ id, question, header, options: [{label, description}], multiSelect }>
 *   onSubmit  - (answers: Record<tabId, string|string[]>) => void
 *   onCancel  - () => void
 *   onChat    - (question, tabIndex) => void
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'

// Match the THEME used by all other overlays in this codebase
const THEME = {
  claude: '#D97706',
  text: '#E5E5E5',
  secondaryText: '#6B7280',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  suggestion: '#3B82F6',
}

// ── Helpers ──

function hasAnswer(answers, q) {
  const a = answers[q.id]
  if (!a) return false
  if (q.multiSelect) return a.length > 0
  return true
}

function allAnswered(answers, questions) {
  return questions.every(q => hasAnswer(answers, q))
}

// ── Component ──

export function SteeringQuestions({
  questions = [],
  onSubmit,
  onCancel,
  onChat,
}) {
  const [activeTab, setActiveTab] = useState(0)
  const [focusIndex, setFocusIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [customInputActive, setCustomInputActive] = useState(false)
  const [customText, setCustomText] = useState('')
  const [submitFocusIndex, setSubmitFocusIndex] = useState(0)

  const totalTabs = questions.length + 1
  const isSubmitTab = activeTab === questions.length
  const currentQuestion = isSubmitTab ? null : questions[activeTab]

  // Option items for current question:  options + "Type something" + "Chat about this"
  const optionItems = currentQuestion
    ? [
        ...currentQuestion.options.map((opt, i) => ({
          type: 'option', index: i, label: opt.label, description: opt.description,
        })),
        { type: 'custom', label: 'Type something.' },
        { type: 'separator' },
        { type: 'chat', label: 'Chat about this' },
      ]
    : []

  const maxFocusIndex = optionItems.length - 1

  // Reset focus state on tab change
  useEffect(() => {
    setFocusIndex(0)
    setCustomInputActive(false)
    setCustomText('')
    setSubmitFocusIndex(0)
  }, [activeTab])

  // Skip separator rows during navigation
  const adjustFocus = (idx, direction) => {
    if (idx < 0) return 0
    if (idx > maxFocusIndex) return maxFocusIndex
    if (optionItems[idx]?.type === 'separator') {
      return direction > 0 ? idx + 1 : idx - 1
    }
    return idx
  }

  // ── Keyboard ──

  useInput((char, key) => {
    if (customInputActive) {
      if (key.escape) {
        setCustomInputActive(false)
        setCustomText('')
      }
      return
    }

    if (key.escape) { onCancel?.(); return }

    // Tab navigation: Tab key, left/right arrows
    if (key.tab) {
      if (key.shift) {
        setActiveTab(t => Math.max(0, t - 1))
      } else {
        setActiveTab(t => Math.min(totalTabs - 1, t + 1))
      }
      return
    }
    if (key.leftArrow) { setActiveTab(t => Math.max(0, t - 1)); return }
    if (key.rightArrow) { setActiveTab(t => Math.min(totalTabs - 1, t + 1)); return }

    // Submit tab: up/down for submit/cancel
    if (isSubmitTab) {
      if (key.upArrow) { setSubmitFocusIndex(i => Math.max(0, i - 1)); return }
      if (key.downArrow) { setSubmitFocusIndex(i => Math.min(1, i + 1)); return }
      if (key.return) {
        if (submitFocusIndex === 0) onSubmit?.(answers)
        else onCancel?.()
        return
      }
      return
    }

    // Question tabs: up/down through options
    if (key.upArrow) { setFocusIndex(i => adjustFocus(i - 1, -1)); return }
    if (key.downArrow) { setFocusIndex(i => adjustFocus(i + 1, 1)); return }

    // Number keys for quick-select
    const num = parseInt(char, 10)
    if (num >= 1 && num <= optionItems.length) {
      const targetIdx = num - 1
      const item = optionItems[targetIdx]
      if (item && item.type !== 'separator') {
        setFocusIndex(targetIdx)
        selectItem(targetIdx)
      }
      return
    }

    // Enter / Space to select
    if (key.return || char === ' ') { selectItem(focusIndex); return }
  }, { isActive: !customInputActive })

  // ── Selection logic ──

  const selectItem = useCallback((idx) => {
    const item = optionItems[idx]
    if (!item || item.type === 'separator') return

    if (item.type === 'chat') { onChat?.(currentQuestion, activeTab); return }
    if (item.type === 'custom') { setCustomInputActive(true); setCustomText(''); return }

    // Regular option
    if (currentQuestion.multiSelect) {
      setAnswers(prev => {
        const existing = prev[currentQuestion.id] || []
        const value = item.label
        const has = existing.includes(value)
        return { ...prev, [currentQuestion.id]: has ? existing.filter(v => v !== value) : [...existing, value] }
      })
    } else {
      setAnswers(prev => ({ ...prev, [currentQuestion.id]: item.label }))
      setTimeout(() => setActiveTab(t => Math.min(totalTabs - 1, t + 1)), 150)
    }
  }, [optionItems, currentQuestion, activeTab, totalTabs, onChat])

  const handleCustomSubmit = useCallback((value) => {
    if (!value.trim()) { setCustomInputActive(false); return }
    if (currentQuestion.multiSelect) {
      setAnswers(prev => {
        const existing = prev[currentQuestion.id] || []
        return { ...prev, [currentQuestion.id]: [...existing, value.trim()] }
      })
    } else {
      setAnswers(prev => ({ ...prev, [currentQuestion.id]: value.trim() }))
      setTimeout(() => setActiveTab(t => Math.min(totalTabs - 1, t + 1)), 150)
    }
    setCustomInputActive(false)
    setCustomText('')
  }, [currentQuestion, totalTabs])

  // ── Render: Tab bar ──

  const renderTabBar = () => {
    const tabs = questions.map((q, i) => {
      const answered = hasAnswer(answers, q)
      const isActive = i === activeTab
      const icon = answered ? '✔' : '☐'
      const iconColor = answered ? THEME.success : THEME.secondaryText

      return React.createElement(Text, {
        key: `tab-${i}`,
        color: isActive ? THEME.claude : THEME.secondaryText,
        bold: isActive,
        underline: isActive,
      },
        React.createElement(Text, { color: iconColor }, icon),
        ' ',
        q.header || `Q${i + 1}`,
        '  '
      )
    })

    // Submit tab
    tabs.push(
      React.createElement(Text, {
        key: 'tab-submit',
        color: isSubmitTab ? THEME.claude : THEME.secondaryText,
        bold: isSubmitTab,
        underline: isSubmitTab,
      },
        React.createElement(Text, { color: THEME.success }, '✔'),
        ' Submit'
      )
    )

    return React.createElement(Box, { flexDirection: 'row', marginBottom: 1 },
      React.createElement(Text, { dimColor: true }, '←  '),
      ...tabs,
      React.createElement(Text, { dimColor: true }, '  →')
    )
  }

  // ── Render: Question tab ──

  const renderQuestionTab = () => {
    if (!currentQuestion) return null

    const answerValue = answers[currentQuestion.id]
    const isMulti = currentQuestion.multiSelect

    const elements = []

    // Question text
    elements.push(
      React.createElement(Text, { key: 'question', bold: true }, currentQuestion.question)
    )
    elements.push(React.createElement(Box, { key: 'spacer-q', marginTop: 1 }))

    // Options
    optionItems.forEach((item, idx) => {
      const isFocused = idx === focusIndex
      const num = idx + 1

      // Separator
      if (item.type === 'separator') {
        elements.push(
          React.createElement(Box, { key: `sep-${idx}`, marginTop: 1 },
            React.createElement(Text, { dimColor: true }, '─'.repeat(48))
          )
        )
        return
      }

      // "Chat about this"
      if (item.type === 'chat') {
        elements.push(
          React.createElement(Box, { key: `chat-${idx}` },
            React.createElement(Text, {
              color: isFocused ? THEME.suggestion : THEME.secondaryText,
              inverse: isFocused,
            },
              isFocused ? ' → ' : '   ',
              `${num}. ${item.label}`
            )
          )
        )
        return
      }

      // "Type something" with inline TextInput when active
      if (item.type === 'custom') {
        if (customInputActive && isFocused) {
          elements.push(
            React.createElement(Box, { key: `custom-${idx}`, flexDirection: 'row' },
              React.createElement(Text, { color: THEME.suggestion, inverse: true }, ' → '),
              React.createElement(Text, { color: THEME.suggestion }, `${num}. `),
              React.createElement(TextInput, {
                value: customText,
                onChange: setCustomText,
                onSubmit: handleCustomSubmit,
                placeholder: 'Type your answer...',
                focus: true,
              })
            )
          )
        } else {
          elements.push(
            React.createElement(Box, { key: `custom-${idx}` },
              React.createElement(Text, {
                color: isFocused ? THEME.suggestion : THEME.secondaryText,
                inverse: isFocused,
              },
                isFocused ? ' → ' : '   ',
                `${num}. Type something.`
              )
            )
          )
        }
        return
      }

      // Regular option
      let isSelected = false
      if (isMulti) {
        isSelected = (answerValue || []).includes(item.label)
      } else {
        isSelected = answerValue === item.label
      }

      const checkbox = isMulti ? (isSelected ? '[x]' : '[ ]') : ''

      elements.push(
        React.createElement(Box, { key: `opt-${idx}`, flexDirection: 'column', marginBottom: 0 },
          React.createElement(Text, {
            color: isFocused ? THEME.suggestion : (isSelected ? THEME.success : undefined),
            inverse: isFocused,
            bold: isSelected,
          },
            isFocused ? ' → ' : '   ',
            `${num}. `,
            isMulti
              ? React.createElement(Text, { color: isSelected ? THEME.success : THEME.secondaryText }, checkbox, ' ')
              : null,
            item.label
          ),
          item.description
            ? React.createElement(Text, { dimColor: !isFocused, color: isFocused ? THEME.suggestion : undefined },
                isMulti ? '        ' : '     ',
                item.description
              )
            : null
        )
      )
    })

    return React.createElement(Box, { flexDirection: 'column' }, ...elements)
  }

  // ── Render: Submit tab ──

  const renderSubmitTab = () => {
    const answered = allAnswered(answers, questions)
    const unansweredCount = questions.filter(q => !hasAnswer(answers, q)).length

    const elements = []

    elements.push(
      React.createElement(Text, { key: 'title', bold: true }, 'Review your answers')
    )
    elements.push(React.createElement(Box, { key: 'spacer', marginTop: 1 }))

    // Answer summary
    questions.forEach((q, i) => {
      const a = answers[q.id]
      const has = hasAnswer(answers, q)
      elements.push(
        React.createElement(Box, { key: `review-${i}`, flexDirection: 'row' },
          React.createElement(Text, { color: has ? THEME.success : THEME.warning },
            has ? ' ✔ ' : ' ☐ '
          ),
          React.createElement(Text, { bold: true }, `${q.header}: `),
          React.createElement(Text, { dimColor: !has },
            has ? (Array.isArray(a) ? a.join(', ') : a) : '(not answered)'
          )
        )
      )
    })

    elements.push(React.createElement(Box, { key: 'spacer2', marginTop: 1 }))

    if (!answered) {
      elements.push(
        React.createElement(Text, { key: 'warn', color: THEME.warning },
          `⚠ You have not answered all questions (${unansweredCount} remaining)`
        )
      )
      elements.push(React.createElement(Box, { key: 'spacer3', marginTop: 1 }))
    }

    elements.push(
      React.createElement(Text, { key: 'prompt', bold: true }, 'Ready to submit your answers?')
    )
    elements.push(React.createElement(Box, { key: 'spacer4', marginTop: 1 }))

    // Submit / Cancel — same selection style as other overlays
    elements.push(
      React.createElement(Box, { key: 'submit-btn' },
        React.createElement(Text, {
          color: submitFocusIndex === 0 ? THEME.suggestion : undefined,
          inverse: submitFocusIndex === 0,
        },
          submitFocusIndex === 0 ? ' → ' : '   ',
          '1. Submit answers'
        )
      )
    )
    elements.push(
      React.createElement(Box, { key: 'cancel-btn' },
        React.createElement(Text, {
          color: submitFocusIndex === 1 ? THEME.suggestion : undefined,
          inverse: submitFocusIndex === 1,
        },
          submitFocusIndex === 1 ? ' → ' : '   ',
          '2. Cancel'
        )
      )
    )

    return React.createElement(Box, { flexDirection: 'column' }, ...elements)
  }

  // ── Main render ──

  return React.createElement(Box, {
    flexDirection: 'column',
    borderStyle: 'round',
    borderColor: THEME.claude,
    padding: 1,
    marginTop: 1,
  },
    // Title
    React.createElement(Text, { bold: true, color: THEME.claude }, '⏺ Steering Questions'),
    React.createElement(Text, { dimColor: true },
      `${questions.filter(q => hasAnswer(answers, q)).length}/${questions.length} answered`
    ),

    // Tab bar
    React.createElement(Box, { marginTop: 1 }, renderTabBar()),

    // Content area
    React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
      isSubmitTab ? renderSubmitTab() : renderQuestionTab()
    ),

    // Footer hint
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { dimColor: true },
        'Enter to select · ↑↓ options · ←→/Tab switch tabs · Esc cancel'
      )
    )
  )
}

export default SteeringQuestions
