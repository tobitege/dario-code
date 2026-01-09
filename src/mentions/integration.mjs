/**
 * Mentions Integration Module
 *
 * Integrates @-mention processing into the application's input handling.
 * This module hooks into the conversation loop and automatically processes
 * any @-mentions in user input before sending to Claude.
 */

import {
  parseMentions,
  processMentions,
  formatMentionsSummary,
  createMentionContext,
  processClipboardImage
} from './index.mjs'

import { getCurrentDir } from '../core/utils.mjs'

/**
 * Process user input for mentions and prepare message
 * Returns { processedInput, messageContent, mentions, warnings }
 */
export async function processUserInput(userInput) {
  const basePath = getCurrentDir()
  const results = {
    input: userInput,
    mentions: [],
    files: [],
    warnings: [],
    hasImages: false,
    messageContent: null,
    displaySummary: ''
  }

  // Check if mentions exist in input
  const mentions = parseMentions(userInput)
  if (mentions.length === 0) {
    results.messageContent = userInput
    return results
  }

  // Process all mentions
  const mentionResults = await processMentions(userInput, basePath)
  results.mentions = mentionResults.mentions
  results.files = mentionResults.files
  results.warnings = mentionResults.warnings

  // Create summary for display
  results.displaySummary = formatMentionsSummary(mentionResults)

  // Create context with file contents
  const mentionContext = await createMentionContext(mentionResults)

  // Build final message content
  // Replace @mentions with file references in the input
  let processedInput = userInput
  for (const mention of mentionResults.mentions) {
    if (mention.success) {
      processedInput = processedInput.replace(
        mention.displayPath,
        `@${mention.displayPath}`
      )
    }
  }

  // Combine user input with mention context
  results.messageContent = processedInput + mentionContext

  return results
}

/**
 * Process clipboard for images
 * Returns { success, path, type, size } or null if no image
 */
export async function processInputWithImage() {
  try {
    const imageResult = await processClipboardImage()
    if (!imageResult) {
      return null
    }

    return {
      success: imageResult.success,
      path: imageResult.path,
      type: imageResult.type,
      size: imageResult.size,
      message: `Image pasted from clipboard: ${imageResult.type.toUpperCase()} (${imageResult.size} bytes)`
    }
  } catch (error) {
    console.error('Failed to process clipboard image:', error.message)
    return null
  }
}

/**
 * Middleware for conversation loop
 * Wraps the original message sending to process mentions
 */
export function createMentionsMiddleware(originalSendMessage) {
  return async function sendMessageWithMentions(conversation) {
    // The last message in conversation is the user's input
    if (conversation.length === 0) {
      return originalSendMessage(conversation)
    }

    const lastMessage = conversation[conversation.length - 1]
    if (lastMessage.role !== 'user') {
      return originalSendMessage(conversation)
    }

    // Process mentions in the user's input
    const processed = await processUserInput(lastMessage.content)

    // Display summary if mentions were found
    if (processed.displaySummary) {
    }

    // Update the message with processed content
    const updatedConversation = [...conversation]
    updatedConversation[updatedConversation.length - 1] = {
      ...lastMessage,
      content: processed.messageContent,
      // Store metadata about mentions for later reference
      _mentions: {
        original: lastMessage.content,
        files: processed.files,
        warnings: processed.warnings
      }
    }

    // Send the updated conversation
    return originalSendMessage(updatedConversation)
  }
}

/**
 * Create a display formatter for mention results
 */
export function formatMentionResults(results) {
  if (results.mentions.length === 0) {
    return ''
  }

  let output = '\n--- @-mention Processing ---\n'

  // Successful mentions
  const successful = results.mentions.filter(m => m.success)
  if (successful.length > 0) {
    output += '\nIncluded files:\n'
    for (const mention of successful) {
      if (mention.count !== undefined) {
        output += `  - ${mention.displayPath} (${mention.count} files)\n`
      } else {
        output += `  - ${mention.displayPath}\n`
      }
    }
  }

  // Failed mentions
  const failed = results.mentions.filter(m => !m.success)
  if (failed.length > 0) {
    output += '\nFailed mentions:\n'
    for (const mention of failed) {
      output += `  - ${mention.path}: ${mention.error}\n`
    }
  }

  output += '\n'
  return output
}

/**
 * Enhanced mention processing with validation
 */
export async function validateAndProcessMentions(input) {
  const mentions = parseMentions(input)

  if (mentions.length === 0) {
    return {
      valid: true,
      mentions: [],
      errors: []
    }
  }

  const validationResults = {
    valid: true,
    mentions: [],
    errors: []
  }

  for (const mention of mentions) {
    const result = await processMentions(mention.path)

    if (result.warnings && result.warnings.length > 0) {
      validationResults.valid = false
      validationResults.errors.push(...result.warnings)
    } else {
      validationResults.mentions.push({
        pattern: mention.path,
        fileCount: result.files.length
      })
    }
  }

  return validationResults
}

export default {
  processUserInput,
  processInputWithImage,
  createMentionsMiddleware,
  formatMentionResults,
  validateAndProcessMentions
}
