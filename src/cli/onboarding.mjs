/**
 * Onboarding Flow
 *
 * Handles first-time user experience and setup wizard.
 * Shows onboarding UI, theme selection, and initial configuration.
 *
 */

import { homedir } from 'os';

/**
 * Main onboarding initialization
 *
 * Decides whether to show onboarding based on:
 * - Whether theme has been selected
 * - Whether onboarding has been completed
 * - Whether authentication method has been chosen
 * - Whether help should be shown
 *
 * @param {boolean} skipPermissions - Skip permission-related onboarding
 * @param {boolean} printMode - Running in print/pipe mode (skip UI)
 * @returns {Promise<void>}
 */
export async function showOnboardingIfNeeded(skipPermissions = false, printMode = false) {
  // Don't show onboarding in print mode
  if (printMode) {
    return;
  }

  const config = loadConfig();

  // Check if theme has been selected
  if (!config.theme) {
    await showThemeSelector();
  }

  // Check if onboarding has been completed
  if (!config.onboardingCompleted) {
    await showOnboardingUI();

    // Mark onboarding as complete
    completeOnboarding();
  }

  // Check if authentication method has been selected
  if (!config.authMethod && !skipPermissions) {
    await showAuthMethodSelector();
  }

  // Show help menu if:
  // - No initial prompt provided
  // - Not in print mode
  // - stdin is empty
  const shouldShowHelp = !process.argv.slice(2).find(arg => !arg.startsWith('-'));

  if (shouldShowHelp && process.stdin.isTTY) {
    await showHelpMenu();
  }
}

/**
 * Shows the theme selection UI
 *
 * Allows user to choose between:
 * - Light theme
 * - Dark theme
 * - Auto (system preference)
 *
 * @returns {Promise<void>}
 */
async function showThemeSelector() {

  // Implementation would show interactive selector
  // For now, just set a default
  const config = loadConfig();
  const updatedConfig = {
    ...config,
    theme: 'dark'
  };
  saveConfig(updatedConfig);
}

/**
 * Shows the main onboarding UI
 *
 * Displays:
 * - Welcome message
 * - Feature overview
 * - Quick start guide
 * - Setup instructions
 *
 * @returns {Promise<void>}
 */
async function showOnboardingUI() {

  // Wait for user input
  await waitForEnter();
}

/**
 * Shows authentication method selector
 *
 * Allows user to choose:
 * - API key authentication
 * - OAuth authentication
 * - Claude desktop integration
 *
 * @returns {Promise<void>}
 */
async function showAuthMethodSelector() {

  // Implementation would show interactive selector
  // For now, just set a default
  const config = loadConfig();
  const updatedConfig = {
    ...config,
    authMethod: 'oauth'
  };
  saveConfig(updatedConfig);
}

/**
 * Shows the help menu
 *
 * Displays available commands and usage examples
 *
 * @returns {Promise<void>}
 */
async function showHelpMenu() {
}

/**
 * Marks onboarding as completed
 *
 * Saves completion state to config and increments startup counter
 *
 *
 * @returns {void}
 */
export function completeOnboarding() {
  const config = loadConfig();
  const updatedConfig = {
    ...config,
    onboardingCompleted: true,
    onboardingCompletedAt: Date.now()
  };
  saveConfig(updatedConfig);

  // Increment startup counter
  incrementStartupCounter();
}

/**
 * Waits for user to press Enter
 *
 * @returns {Promise<void>}
 */
async function waitForEnter() {
  return new Promise((resolve) => {
    process.stdin.once('data', () => {
      resolve();
    });
  });
}

/**
 * Increments the startup counter
 *
 * @returns {void}
 */
function incrementStartupCounter() {
  const config = loadConfig();
  const updatedConfig = {
    ...config,
    numStartups: (config.numStartups ?? 0) + 1
  };
  saveConfig(updatedConfig);
}

// Placeholder functions
function loadConfig() {
  throw new Error('Not implemented - see src/config/index.mjs');
}

function saveConfig() {
  throw new Error('Not implemented - see src/config/index.mjs');
}
