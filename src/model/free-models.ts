import { logger } from "../utils/logger.js";

/**
 * Model groups to display in Telegram bot.
 * Only models from these groups will be shown in the model selection menu.
 */
export const MODEL_GROUPS = {
  GITHUB_COPILOT: "github-copilot",
  OPENCODE_ZEN_FREE: "opencode-zen-free",
} as const;

export type ModelGroup = (typeof MODEL_GROUPS)[keyof typeof MODEL_GROUPS];

/**
 * Explicit list of models to show in Telegram /models menu.
 * ONLY these models will appear in the menu.
 */
const TELEGRAM_ALLOWED_MODELS: Array<{ providerID: string; modelPattern: string }> = [
  // OpenCode Go Provider — open-source coding models (7 models)
  { providerID: "opencode-go", modelPattern: "glm-5" },
  { providerID: "opencode-go", modelPattern: "glm-5.1" },
  { providerID: "opencode-go", modelPattern: "kimi-k2.5" },
  { providerID: "opencode-go", modelPattern: "mimo-v2-omni" },
  { providerID: "opencode-go", modelPattern: "mimo-v2-pro" },
  { providerID: "opencode-go", modelPattern: "minimax-m2.5" },
  { providerID: "opencode-go", modelPattern: "minimax-m2.7" },

  // OpenCode Provider — free + GitHub Copilot models (6 models)
  { providerID: "opencode", modelPattern: "big-pickle" },
  { providerID: "opencode", modelPattern: "nemotron-3-super-free" },
  { providerID: "opencode", modelPattern: "claude-sonnet-4-6" },
  { providerID: "opencode", modelPattern: "gpt-5.2" },
  { providerID: "opencode", modelPattern: "gpt-5.3-codex" },
  { providerID: "opencode", modelPattern: "gpt-5.4-mini" },
];

/**
 * Check if a model matches any free model pattern.
 */
function matchesPattern(text: string, pattern: string): boolean {
  return text.toLowerCase() === pattern.toLowerCase();
}

/**
 * Check if a model matches any pattern from a specific list.
 */
function matchesAnyPattern(
  providerID: string,
  modelID: string,
  patterns: Array<{ providerID: string; modelPattern: string }>,
): boolean {
  for (const pattern of patterns) {
    if (pattern.providerID !== "*" && pattern.providerID !== providerID) {
      continue;
    }
    if (matchesPattern(modelID, pattern.modelPattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a model is available for Telegram /models menu.
 * Uses TELEGRAM_ALLOWED_MODELS explicit list.
 * @param providerID Provider ID (e.g., "opencode-go", "github-copilot")
 * @param modelID Model ID (e.g., "qwen", "claude-3-5-sonnet")
 * @param customPatterns Optional custom patterns (not used for Telegram)
 * @returns true if model is in allowed list
 */
export function isFreeModel(
  providerID: string,
  modelID: string,
  _customPatterns?: Array<{ providerID: string; modelPattern: string }>,
): boolean {
  // Always use TELEGRAM_ALLOWED_MODELS for the bot menu
  const patterns = TELEGRAM_ALLOWED_MODELS;

  for (const pattern of patterns) {
    // Check if provider matches (wildcard "*" matches all providers)
    if (pattern.providerID !== "*" && pattern.providerID !== providerID) {
      continue;
    }

    // Check if model ID matches pattern
    if (matchesPattern(modelID, pattern.modelPattern)) {
      logger.debug(
        `[FreeModels] Model ${providerID}/${modelID} matches free pattern: ${pattern.providerID}/${pattern.modelPattern}`,
      );
      return true;
    }
  }

  return false;
}

/**
 * Get list of free models from all available models.
 * @param models All available models from OpenCode
 * @param customPatterns Optional custom free model patterns
 * @returns Filtered list of free models
 */
export function filterFreeModels(
  providers: Array<{ id: string; models: Record<string, unknown> }>,
  customPatterns?: Array<{ providerID: string; modelPattern: string }>,
): Array<{ providerID: string; modelID: string }> {
  const freeModels: Array<{ providerID: string; modelID: string }> = [];

  for (const provider of providers) {
    for (const modelID of Object.keys(provider.models)) {
      if (isFreeModel(provider.id, modelID, customPatterns)) {
        freeModels.push({
          providerID: provider.id,
          modelID,
        });
      }
    }
  }

  logger.info(
    `[FreeModels] Filtered ${freeModels.length} free models from ${providers.length} providers`,
  );
  return freeModels;
}

/**
 * Filter models by the two Telegram bot groups: GitHub Copilot and OpenCode Zen Free.
 * @param providers All available providers and models from OpenCode API
 * @returns Models filtered to only those from GitHub Copilot and OpenCode Zen Free groups
 */
export function filterModelsByTelegramGroups(
  providers: Array<{ id: string; models: Record<string, unknown> }>,
): Array<{ providerID: string; modelID: string }> {
  const filteredModels: Array<{ providerID: string; modelID: string }> = [];

  for (const provider of providers) {
    for (const modelID of Object.keys(provider.models)) {
      const allowed = matchesAnyPattern(provider.id, modelID, TELEGRAM_ALLOWED_MODELS);

      if (allowed) {
        filteredModels.push({
          providerID: provider.id,
          modelID,
        });
      }
    }
  }

  logger.info(`[FreeModels] Filtered ${filteredModels.length} allowed models`);
  return filteredModels;
}
