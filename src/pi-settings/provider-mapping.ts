/**
 * CCS provider ID to Pi auth provider key mapping.
 *
 * Pi docs list provider keys including:
 *   anthropic, openai, deepseek, google, mistral, groq, kimi-coding, minimax
 *
 * Unsupported or ambiguous CCS-to-Pi provider mappings must fail with a clear
 * message rather than guessing.
 */

import type { ProviderPresetId } from '../shared/provider-preset-catalog';

/** Pi auth provider keys supported by this mapping. */
export type PiAuthProviderKey =
  | 'anthropic'
  | 'openai'
  | 'deepseek'
  | 'google'
  | 'mistral'
  | 'groq'
  | 'kimi-coding'
  | 'minimax';

/** Canonical mapping from CCS preset IDs to Pi auth provider keys. */
const CCS_TO_PI_PROVIDER_MAP: Readonly<Partial<Record<ProviderPresetId, PiAuthProviderKey>>> = {
  anthropic: 'anthropic',
  deepseek: 'deepseek',
  glm: 'anthropic', // GLM uses Anthropic-compatible API
  km: 'kimi-coding',
  mm: 'minimax',
  qwen: 'anthropic', // Qwen uses Anthropic-compatible API
  novita: 'anthropic', // Novita uses Anthropic-compatible API
  foundry: 'anthropic', // Azure Foundry uses Anthropic-compatible API
};

/** Additional aliases that are not canonical preset IDs but may appear. */
const CCS_ALIAS_TO_PI_PROVIDER_MAP: Readonly<Record<string, PiAuthProviderKey>> = {
  kimi: 'kimi-coding',
  hf: 'openai',
};

/** Providers that explicitly do NOT support API keys (local runtimes). */
const API_KEY_UNSUPPORTED_PROVIDERS = new Set<string>([
  'ollama',
  'llamacpp',
  'huggingface',
  'ollama-cloud',
]);

/**
 * Map a CCS provider ID to a Pi auth provider key.
 *
 * @param ccsProviderId - CCS provider preset ID or alias
 * @returns Pi auth provider key
 * @throws Error if the provider is unsupported or ambiguous
 */
export function mapCcsProviderToPiAuthProvider(ccsProviderId: string): PiAuthProviderKey {
  const normalized = ccsProviderId.trim().toLowerCase();

  // Check canonical preset IDs first
  const mapped = CCS_TO_PI_PROVIDER_MAP[normalized as ProviderPresetId];
  if (mapped !== undefined) {
    return mapped;
  }

  // Check aliases
  if (normalized in CCS_ALIAS_TO_PI_PROVIDER_MAP) {
    return CCS_ALIAS_TO_PI_PROVIDER_MAP[normalized];
  }

  // Known unsupported providers with clear message
  if (API_KEY_UNSUPPORTED_PROVIDERS.has(normalized)) {
    throw new Error(
      `Provider "${ccsProviderId}" does not use API keys (local/cloud runtime). ` +
        `No Pi auth entry needed.`
    );
  }

  // Unknown provider — fail clearly rather than guess
  throw new Error(
    `Unsupported CCS provider "${ccsProviderId}" for Pi auth mapping. ` +
      `Supported providers: ${getSupportedCcsProviderIds().join(', ')}`
  );
}

/**
 * Get the list of CCS provider IDs that can be mapped to Pi auth providers.
 */
export function getSupportedCcsProviderIds(): string[] {
  return Object.keys(CCS_TO_PI_PROVIDER_MAP);
}

/**
 * Get the list of Pi auth provider keys that are supported.
 */
export function getSupportedPiAuthProviderKeys(): PiAuthProviderKey[] {
  return ['anthropic', 'openai', 'deepseek', 'google', 'mistral', 'groq', 'kimi-coding', 'minimax'];
}

/**
 * Check if a CCS provider ID is supported for Pi auth mapping.
 */
export function isSupportedCcsProviderForPi(ccsProviderId: string): boolean {
  try {
    mapCcsProviderToPiAuthProvider(ccsProviderId);
    return true;
  } catch {
    return false;
  }
}
