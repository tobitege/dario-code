/**
 * AskUserQuestion Tool
 *
 * Allows Claude to ask the user questions during execution.
 * Supports multiple choice questions with rich descriptions.
 */

// Tool metadata
export const ASK_USER_SHORT_DESCRIPTION = "Ask the user questions during execution."

export const ASK_USER_PROMPT = `Use this tool when you need to ask the user questions during execution. This allows you to:
1. Gather user preferences or requirements
2. Clarify ambiguous instructions
3. Get decisions on implementation choices as you work
4. Offer choices to the user about what direction to take.

Usage notes:
- Users will always be able to select "Other" to provide custom text input
- Use multiSelect: true to allow multiple answers to be selected for a question
- If you recommend a specific option, make that the first option in the list and add "(Recommended)" at the end of the label`

// Input schema
export const askUserInputSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      description: 'Questions to ask the user (1-4 questions)',
      minItems: 1,
      maxItems: 4,
      items: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The complete question to ask the user. Should be clear, specific, and end with a question mark.'
          },
          header: {
            type: 'string',
            description: 'Very short label displayed as a chip/tag (max 12 chars). Examples: "Auth method", "Library", "Approach".'
          },
          options: {
            type: 'array',
            description: 'The available choices for this question. Must have 2-4 options.',
            minItems: 2,
            maxItems: 4,
            items: {
              type: 'object',
              properties: {
                label: {
                  type: 'string',
                  description: 'The display text for this option (1-5 words).'
                },
                description: {
                  type: 'string',
                  description: 'Explanation of what this option means or what will happen if chosen.'
                }
              },
              required: ['label', 'description']
            }
          },
          multiSelect: {
            type: 'boolean',
            description: 'Set to true to allow the user to select multiple options instead of just one.'
          }
        },
        required: ['question', 'header', 'options', 'multiSelect']
      }
    },
    answers: {
      type: 'object',
      description: 'User answers collected by the permission component',
      additionalProperties: {
        type: 'string'
      }
    }
  },
  required: ['questions']
}

/**
 * Format a question for display
 */
function formatQuestion(question, index) {
  const lines = []
  lines.push(`\n[${question.header}] ${question.question}`)

  question.options.forEach((opt, i) => {
    const marker = question.multiSelect ? '☐' : '○'
    lines.push(`  ${marker} ${opt.label}`)
    if (opt.description) {
      lines.push(`      ${opt.description}`)
    }
  })

  lines.push(`  ${question.multiSelect ? '☐' : '○'} Other (custom input)`)

  return lines.join('\n')
}

/**
 * Create the AskUserQuestion tool
 */
export function createAskUserQuestionTool(dependencies = {}) {
  const { readline, prompt } = dependencies

  return {
    name: 'AskUserQuestion',

    description() {
      return ASK_USER_SHORT_DESCRIPTION
    },

    prompt() {
      return ASK_USER_PROMPT
    },

    inputSchema: askUserInputSchema,

    userFacingName() {
      return 'Ask User'
    },

    isEnabled() {
      return true
    },

    isReadOnly() {
      return true
    },

    needsPermissions() {
      return false
    },

    /**
     * Render result for assistant
     */
    renderResultForAssistant({ questions, answers, error }) {
      if (error) return error

      if (!answers || Object.keys(answers).length === 0) {
        return 'User did not provide answers.'
      }

      const results = []
      questions.forEach((q, i) => {
        const key = `question_${i}`
        const answer = answers[key] || answers[q.header] || 'No answer'
        results.push(`${q.header}: ${answer}`)
      })

      return `User responded:\n${results.join('\n')}`
    },

    /**
     * Render tool use message
     */
    renderToolUseMessage(input) {
      const count = input.questions?.length || 0
      const headers = input.questions?.map(q => q.header).join(', ') || ''
      return `Asking ${count} question(s): ${headers}`
    },

    /**
     * Validate input
     */
    validateInput({ questions }) {
      if (!questions || !Array.isArray(questions)) {
        return { result: false, message: 'Questions must be an array.' }
      }

      if (questions.length < 1 || questions.length > 4) {
        return { result: false, message: 'Must provide 1-4 questions.' }
      }

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]

        if (!q.question || typeof q.question !== 'string') {
          return { result: false, message: `Question ${i + 1} must have a question string.` }
        }

        if (!q.header || typeof q.header !== 'string') {
          return { result: false, message: `Question ${i + 1} must have a header.` }
        }

        if (q.header.length > 12) {
          return { result: false, message: `Question ${i + 1} header must be max 12 characters.` }
        }

        if (!q.options || !Array.isArray(q.options)) {
          return { result: false, message: `Question ${i + 1} must have options array.` }
        }

        if (q.options.length < 2 || q.options.length > 4) {
          return { result: false, message: `Question ${i + 1} must have 2-4 options.` }
        }

        for (let j = 0; j < q.options.length; j++) {
          const opt = q.options[j]
          if (!opt.label || typeof opt.label !== 'string') {
            return { result: false, message: `Question ${i + 1}, option ${j + 1} must have a label.` }
          }
          if (!opt.description || typeof opt.description !== 'string') {
            return { result: false, message: `Question ${i + 1}, option ${j + 1} must have a description.` }
          }
        }
      }

      return { result: true }
    },

    /**
     * Execute - in CLI context, this would trigger the UI to show the questions
     * The actual answers come back through the answers field on subsequent calls
     */
    async * call({ questions, answers }) {
      // If answers are provided, return them
      if (answers && Object.keys(answers).length > 0) {
        const result = {
          questions,
          answers,
          error: ''
        }

        yield {
          type: 'result',
          data: result,
          resultForAssistant: this.renderResultForAssistant(result)
        }
        return
      }

      // Otherwise, format questions for display and wait for user input
      // In a full implementation, this would trigger an interactive UI
      const formatted = questions.map((q, i) => formatQuestion(q, i)).join('\n')

      const result = {
        questions,
        answers: {},
        pending: true,
        display: formatted,
        error: ''
      }

      yield {
        type: 'result',
        data: result,
        resultForAssistant: `Waiting for user to answer:\n${formatted}`
      }
    }
  }
}

export default createAskUserQuestionTool
