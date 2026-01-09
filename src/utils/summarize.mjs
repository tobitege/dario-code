/**
 * Conversation Summarization Utilities
 */

import { runQuery } from '../api/streaming.mjs';
import { createMessage } from './messages.mjs';

const SUMMARIZATION_PROMPT = `
You are a conversation summarizer. Your task is to read the provided conversation history and create a concise summary. The summary should be written from the perspective of an omniscient narrator, explaining what was discussed and what actions were taken.

Focus on key decisions, important facts, code snippets, tool outputs, and unresolved questions. Preserve the essential context needed for an AI assistant to pick up the conversation where it left off.

The conversation history is provided below. Generate a summary.
`;

/**
 * Summarize a chunk of conversation messages.
 * @param {Array} messages - The array of messages to summarize.
 * @returns {Promise<string>} - The generated summary text.
 */
async function summarize(messages) {
  const content = messages.map(msg => {
    const role = msg.message?.role || msg.role;
    const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    return `${role}: ${text}`;
  }).join('\n\n');

  try {
    const summaryResult = await runQuery(
      `${SUMMARIZATION_PROMPT}\n\n---\n\n${content}`,
      [], // No tools needed for summarization
      { model: 'claude-haiku-4-5-20251001' } // Use a fast model for summarization
    );

    const summaryText = summaryResult[0]?.message?.content?.[0]?.text || '[Could not generate summary]';
    return summaryText;
  } catch (error) {
    console.error('Summarization failed:', error);
    return '[Summarization failed]';
  }
}

/**
 * Compact messages by summarizing older turns to free context space.
 * Keeps the first system-relevant message and last N messages intact.
 * @param {Array} messages - The full message history.
 * @param {number} keepLastN - The number of recent messages to keep untouched.
 * @returns {Promise<Array>} - The compacted message history.
 */
export async function compactMessagesWithAi(messages, keepLastN = 8) {
  if (messages.length <= keepLastN + 2) {
    return messages;
  }

  const toSummarize = messages.slice(0, -keepLastN);
  const toKeep = messages.slice(-keepLastN);

  const summaryText = await summarize(toSummarize);

  const summaryMessage = createMessage(
    'user',
    `[Context compacted: ${toSummarize.length} older messages were summarized to free up space.]

**Summary of earlier conversation:**
${summaryText}`
  );

  return [summaryMessage, ...toKeep];
}
