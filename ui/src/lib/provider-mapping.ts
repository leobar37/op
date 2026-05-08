/**
 * Provider mapping utilities for Droid BYOK custom model entries.
 *
 * Maps CLIProxy provider IDs and model IDs to the correct Droid provider
 * value ('anthropic', 'openai', or 'generic-chat-completion-api').
 */

export type DroidProviderValue = 'anthropic' | 'openai' | 'generic-chat-completion-api';

/**
 * Static mapping from CLIProxy provider IDs to their Droid API type.
 * Derived from the provider preset catalog base URLs and known API formats.
 *
 * NOTE: These are CLIProxy provider IDs (from /api/provider-models), NOT
 * provider preset IDs. CLIProxy IDs: gemini, codex, agy, qwen, iflow, kiro,
 * ghcp, claude, kimi, cursor, gitlab, codebuddy, kilo.
 */
const PROVIDER_TO_DROID_API_TYPE: Readonly<Record<string, DroidProviderValue>> = {
  // OpenAI-native providers
  codex: 'openai',

  // Anthropic-native providers
  claude: 'anthropic',
  agy: 'anthropic',

  // Gemini uses OpenAI-compatible format via CLIProxy
  gemini: 'openai',

  // Chinese / alternative providers — mapped by their upstream API format
  // kimi (Moonshot) uses OpenAI-compatible API
  kimi: 'generic-chat-completion-api',
  // deepseek uses Anthropic-compatible endpoint (/anthropic)
  deepseek: 'anthropic',
  // glm (Zhipu AI) uses Anthropic-compatible endpoint (/anthropic)
  glm: 'anthropic',
  // mm (MiniMax) uses Anthropic-compatible endpoint (/anthropic)
  mm: 'anthropic',
  // qwen uses Anthropic-compatible endpoint
  qwen: 'anthropic',

  // OpenAI-compatible routers (not currently exposed via CLIProxy but mapped for completeness)
  huggingface: 'generic-chat-completion-api',
  'ollama-cloud': 'generic-chat-completion-api',
  ollama: 'generic-chat-completion-api',
  llamacpp: 'generic-chat-completion-api',
};

/**
 * Infer Droid provider from model ID naming conventions.
 */
function inferProviderFromModel(modelId: string): DroidProviderValue | null {
  const normalized = modelId.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized.startsWith('claude-')) {
    return 'anthropic';
  }

  if (
    normalized.startsWith('gpt-') ||
    normalized.startsWith('o1') ||
    normalized.startsWith('o3') ||
    normalized.startsWith('o4')
  ) {
    return 'openai';
  }

  if (
    normalized.startsWith('deepseek') ||
    normalized.startsWith('glm') ||
    normalized.startsWith('minimax')
  ) {
    return 'generic-chat-completion-api';
  }

  return null;
}

/**
 * Resolve the correct Droid provider value for a given CLIProxy provider
 * and model combination.
 *
 * Precedence:
 * 1. Explicit provider ID mapping (PROVIDER_TO_DROID_API_TYPE)
 * 2. Model ID inference (claude-* → anthropic, gpt-* → openai)
 * 3. Fallback to 'anthropic' for backward compatibility
 */
export function resolveDroidProviderForModel(
  providerId: string,
  modelId: string
): DroidProviderValue {
  const normalizedProvider = providerId.trim().toLowerCase();

  // 1. Provider-level mapping
  const fromProvider = PROVIDER_TO_DROID_API_TYPE[normalizedProvider];
  if (fromProvider) {
    return fromProvider;
  }

  // 2. Model-level inference
  const fromModel = inferProviderFromModel(modelId);
  if (fromModel) {
    return fromModel;
  }

  // 3. Backward-compatible default
  return 'anthropic';
}
