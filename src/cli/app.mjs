/**
 * Main application module
 * Handles the main application flow and user interaction
 */

import * as ui from '../terminal/ui.mjs';
import * as auth from '../auth/auth.mjs';
import * as api from '../api/client.mjs';
import * as commands from './commands.mjs';
import * as git from '../git/git.mjs';
import * as sessions from '../sessions/index.mjs';
import { VERSION } from '../config/constants.mjs';
import { loadEnv } from '../config/env.mjs';

/**
 * Initialize the application
 */
export async function initialize(options = {}) {
  try {
    // Load environment variables
    loadEnv();

    // Initialize session storage
    await sessions.initSessions();

    // Show welcome message
    ui.showWelcome();

    // Bypass authentication for development
    // const token = await auth.authenticate();
    // if (!token) {
    //   ui.showError('Authentication failed. Please try again.');
    //   process.exit(1);
    // }

    // Check if current directory is a git repository
    const isGitRepo = await git.isGitRepo();
    if (isGitRepo) {
      const repoInfo = await git.getRepoInfo();
    }

    // Handle session resume flags
    let currentSession = null;
    if (options.continue) {
      // Resume the latest session
      currentSession = await sessions.getLatestSession();
      if (currentSession) {
        ui.print(`Resumed session: ${currentSession.name}`);
      } else {
        ui.print('No previous session found. Starting new session.');
        currentSession = await sessions.createSession();
      }
    } else if (options.resume) {
      // Resume a specific session by ID
      currentSession = await sessions.getSession(options.resume);
      if (currentSession) {
        ui.print(`Resumed session: ${currentSession.name}`);
      } else {
        ui.showError(`Session ${options.resume} not found`);
        process.exit(1);
      }
    } else {
      // Start a new session
      currentSession = await sessions.createSession();
    }

    // Start conversation loop
    await startConversation(currentSession);
  } catch (error) {
    ui.showError(`Initialization error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Start the conversation loop
 */
async function startConversation(currentSession) {
  const conversation = currentSession.messages || [];

  while (true) {
    // Get user input
    const input = await ui.prompt('> ');

    // Check if it's a command
    if (commands.isCommand(input)) {
      const handled = await commands.processCommand(input);
      if (handled) continue;
    }

    // Not a command, send to Claude
    try {
      // Add user message to conversation and session
      const userMessage = { role: 'user', content: input };
      conversation.push(userMessage);
      await sessions.addMessage(currentSession.id, 'user', input);

      // Send request to Claude
      const response = await api.sendRequest(conversation);

      // Display response
      ui.showResponse(response.response);

      // Add response to conversation history and session
      const assistantMessage = { role: 'assistant', content: response.response };
      conversation.push(assistantMessage);
      await sessions.addMessage(currentSession.id, 'assistant', response.response);
    } catch (error) {
      ui.showError(`Error communicating with Claude: ${error.message}`);
    }
  }
}
