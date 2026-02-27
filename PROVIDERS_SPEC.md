# Providers Feature Spec

## Goal
Add multi-provider support to Dario Code. Users can add API providers (OpenRouter, Ollama, Moonshot, MiniMax, GLM, Groq, etc.), enable models from each, and those models appear in `/model`.

---

## Architecture

### 1. Provider Registry — `src/providers/registry.mjs`

Built-in provider definitions:
```js
export const BUILTIN_PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseURL: 'https://api.anthropic.com',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    apiKeyURL: 'https://console.anthropic.com/keys',
    sdkCompat: 'anthropic',
    isLocal: false,
    isBuiltin: true,
    models: [ ...claude models... ]
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    apiKeyURL: 'https://openrouter.ai/keys',
    sdkCompat: 'openai',
    isLocal: false,
    models: [ ...many models... ]
  },
  // moonshot, minimax, glm, groq, deepseek, mistral, together, fireworks,
  // perplexity, cerebras, xai, novita, ollama, lmstudio ...
]
```

### 2. Provider Config — stored in `~/.dario/providers.json`
```json
{
  "providers": [
    {
      "id": "openrouter",
      "enabled": true,
      "apiKey": "sk-or-...",
      "enabledModels": ["openai/gpt-4o", "anthropic/claude-opus-4-6"]
    },
    {
      "id": "ollama",
      "enabled": true,
      "baseURL": "http://localhost:11434/v1",
      "enabledModels": ["llama3.2", "qwen2.5-coder"]
    }
  ]
}
```

### 3. API Client — update `src/api/client.mjs`
- `getClientForModel(modelId)` — returns correct Anthropic/OpenAI SDK instance for the model
- OpenAI-compat providers: use `openai` npm package with custom `baseURL`
- Anthropic-compat: use `@anthropic-ai/sdk` with `baseURL` override
- Store active provider+model in session state

### 4. Model list — update `src/cli/commands.mjs`
- `getAvailableModels()` — merges BUILTIN Anthropic models + enabled models from provider config
- Groups models by provider in the `/model` picker UI

### 5. `/providers` command — `src/cli/commands.mjs` (new export: `providersCommand`)
Subcommands:
- `/providers` — list all providers (enabled/disabled, model count)
- `/providers add <id>` — enable a provider, prompt for API key if needed
- `/providers remove <id>` — disable a provider
- `/providers models <id>` — list/toggle models for a provider
- `/providers key <id> <key>` — set API key for a provider

### 6. TUI overlay — `src/tui/claude/components/provider-manager.mjs`
Interactive provider manager (like the existing mcp-manager / config-manager pattern):
- List providers with status badges
- Click to expand → set API key + toggle individual models
- Save immediately to `~/.dario/providers.json`

---

## Implementation Steps

1. Create `src/providers/registry.mjs` with BUILTIN_PROVIDERS (populate from PROVIDERS_DATA.json)
2. Create `src/providers/config.mjs` — load/save `~/.dario/providers.json`
3. Create `src/providers/client-factory.mjs` — `getClientForModel(modelId)` 
4. Update `src/api/streaming.mjs` — use `getClientForModel` instead of hardcoded `getClient()`
5. Update `src/cli/commands.mjs` — `getAvailableModels()`, `providersCommand`, update `AVAILABLE_MODELS`
6. Create `src/tui/claude/components/provider-manager.mjs` — TUI overlay
7. Update `src/tui/claude/main.mjs` — wire `/providers` overlay + update model selector to show provider groups
8. Update `src/cli/commander-setup.mjs` — no changes needed (slash commands only)

---

## Key rules
- Anthropic stays the default, always present, cannot be removed
- API keys stored in `~/.dario/providers.json` (never in project files)
- OpenAI-compat providers: install `openai` npm package or use native fetch
- Local providers (Ollama, LM Studio): baseURL overrideable, no key required  
- Model IDs from other providers prefixed: `openrouter/openai/gpt-4o`, `ollama/llama3.2`
- When sending to non-Anthropic providers, do NOT send Claude Code system prompt markers
- Commit after each file created
