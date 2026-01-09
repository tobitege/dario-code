/**
 * Plan Mode Tools
 *
 * EnterPlanMode and ExitPlanMode for design-first implementation workflow.
 * Allows Claude to explore the codebase and design an approach before writing code.
 */

// EnterPlanMode metadata
export const ENTER_PLAN_SHORT_DESCRIPTION = "Enter plan mode to design an implementation approach."

export const ENTER_PLAN_PROMPT = `Use this tool proactively when you're about to start a non-trivial implementation task. Getting user sign-off on your approach before writing code prevents wasted effort and ensures alignment. This tool transitions you into plan mode where you can explore the codebase and design an implementation approach for user approval.

## When to Use This Tool

**Prefer using EnterPlanMode** for implementation tasks unless they're simple. Use it when ANY of these conditions apply:

1. **New Feature Implementation**: Adding meaningful new functionality
2. **Multiple Valid Approaches**: The task can be solved in several different ways
3. **Code Modifications**: Changes that affect existing behavior or structure
4. **Architectural Decisions**: The task requires choosing between patterns or technologies
5. **Multi-File Changes**: The task will likely touch more than 2-3 files
6. **Unclear Requirements**: You need to explore before understanding the full scope
7. **User Preferences Matter**: The implementation could reasonably go multiple ways

## When NOT to Use This Tool

Only skip EnterPlanMode for simple tasks:
- Single-line or few-line fixes (typos, obvious bugs, small tweaks)
- Adding a single function with clear requirements
- Tasks where the user has given very specific, detailed instructions
- Pure research/exploration tasks

## What Happens in Plan Mode

In plan mode, you'll:
1. Thoroughly explore the codebase using Glob, Grep, and Read tools
2. Understand existing patterns and architecture
3. Design an implementation approach
4. Present your plan to the user for approval
5. Exit plan mode with ExitPlanMode when ready to implement`

// ExitPlanMode metadata
export const EXIT_PLAN_SHORT_DESCRIPTION = "Exit plan mode after finishing your plan."

export const EXIT_PLAN_PROMPT = `Use this tool when you are in plan mode and have finished writing your plan to the plan file and are ready for user approval.

## How This Tool Works
- You should have already written your plan to the plan file specified in the plan mode system message
- This tool does NOT take the plan content as a parameter - it will read the plan from the file you wrote
- This tool simply signals that you're done planning and ready for the user to review and approve

## When to Use This Tool
IMPORTANT: Only use this tool when the task requires planning the implementation steps of a task that requires writing code. For research tasks where you're gathering information, searching files, reading files or in general trying to understand the codebase - do NOT use this tool.

## Handling Ambiguity in Plans
Before using this tool, ensure your plan is clear and unambiguous. If there are multiple valid approaches or unclear requirements:
1. Use the AskUserQuestion tool to clarify with the user
2. Ask about specific implementation choices
3. Clarify any assumptions that could affect the implementation
4. Edit your plan file to incorporate user feedback
5. Only proceed with ExitPlanMode after resolving ambiguities`

// Input schemas
export const enterPlanInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: true
}

export const exitPlanInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: true
}

/**
 * Create the EnterPlanMode tool
 */
export function createEnterPlanModeTool(dependencies = {}) {
  const { planManager } = dependencies

  return {
    name: 'EnterPlanMode',

    description() {
      return ENTER_PLAN_SHORT_DESCRIPTION
    },

    prompt() {
      return ENTER_PLAN_PROMPT
    },

    inputSchema: enterPlanInputSchema,

    userFacingName() {
      return 'Enter Plan Mode'
    },

    isEnabled() {
      return true
    },

    isReadOnly() {
      return true
    },

    needsPermissions() {
      // Entering plan mode requires user consent
      return true
    },

    renderResultForAssistant({ success, message, error }) {
      if (error) return error
      return message || 'Entered plan mode. You can now explore the codebase and design your implementation approach.'
    },

    renderToolUseMessage() {
      return 'Requesting to enter plan mode for implementation design'
    },

    validateInput() {
      return { result: true }
    },

    async * call() {
      try {
        // Check if already in plan mode
        if (planManager?.isInPlanMode?.()) {
          const result = {
            success: false,
            message: 'Already in plan mode.',
            error: ''
          }
          yield {
            type: 'result',
            data: result,
            resultForAssistant: this.renderResultForAssistant(result)
          }
          return
        }

        // Enter plan mode
        if (planManager?.enter) {
          await planManager.enter()
        }

        const result = {
          success: true,
          message: `Entered plan mode.

You are now in plan mode. In this mode:
1. Explore the codebase to understand the current architecture
2. Identify files that need to be modified or created
3. Design your implementation approach
4. Write your plan to a file
5. Use ExitPlanMode when ready for user approval

Focus on understanding before implementing.`,
          error: ''
        }

        yield {
          type: 'result',
          data: result,
          resultForAssistant: this.renderResultForAssistant(result)
        }
      } catch (err) {
        const result = {
          success: false,
          message: '',
          error: err instanceof Error ? err.message : 'Failed to enter plan mode'
        }
        yield {
          type: 'result',
          data: result,
          resultForAssistant: this.renderResultForAssistant(result)
        }
      }
    }
  }
}

/**
 * Create the ExitPlanMode tool
 */
export function createExitPlanModeTool(dependencies = {}) {
  const { planManager } = dependencies

  return {
    name: 'ExitPlanMode',

    description() {
      return EXIT_PLAN_SHORT_DESCRIPTION
    },

    prompt() {
      return EXIT_PLAN_PROMPT
    },

    inputSchema: exitPlanInputSchema,

    userFacingName() {
      return 'Exit Plan Mode'
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

    renderResultForAssistant({ success, message, error }) {
      if (error) return error
      return message || 'Exited plan mode. Ready to implement.'
    },

    renderToolUseMessage() {
      return 'Exiting plan mode - plan ready for review'
    },

    validateInput() {
      return { result: true }
    },

    async * call() {
      try {
        // Check if in plan mode
        if (planManager?.isInPlanMode && !planManager.isInPlanMode()) {
          const result = {
            success: false,
            message: 'Not currently in plan mode.',
            error: ''
          }
          yield {
            type: 'result',
            data: result,
            resultForAssistant: this.renderResultForAssistant(result)
          }
          return
        }

        // Exit plan mode
        if (planManager?.exit) {
          await planManager.exit()
        }

        const result = {
          success: true,
          message: `Exited plan mode.

Your plan is now ready for user review. Wait for user approval before proceeding with implementation.`,
          error: ''
        }

        yield {
          type: 'result',
          data: result,
          resultForAssistant: this.renderResultForAssistant(result)
        }
      } catch (err) {
        const result = {
          success: false,
          message: '',
          error: err instanceof Error ? err.message : 'Failed to exit plan mode'
        }
        yield {
          type: 'result',
          data: result,
          resultForAssistant: this.renderResultForAssistant(result)
        }
      }
    }
  }
}

export default { createEnterPlanModeTool, createExitPlanModeTool }
