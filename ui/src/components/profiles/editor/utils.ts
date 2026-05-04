/**
 * Utility functions for Profile Editor
 */

/** Check if a key is considered sensitive (API keys, tokens, etc.) */
export function isSensitiveKey(key: string): boolean {
  const sensitivePatterns = [
    /^ANTHROPIC_AUTH_TOKEN$/,
    /_API_KEY$/,
    /_AUTH_TOKEN$/,
    /^API_KEY$/,
    /^AUTH_TOKEN$/,
    /_SECRET$/,
    /^SECRET$/,
  ];
  return sensitivePatterns.some((pattern) => pattern.test(key));
}

/**
 * Extract tier mapping from settings env vars
 */
export function extractTierMapping(env: Record<string, string>): {
  opus?: string;
  sonnet?: string;
  haiku?: string;
} {
  return {
    opus: env.ANTHROPIC_DEFAULT_OPUS_MODEL || undefined,
    sonnet: env.ANTHROPIC_DEFAULT_SONNET_MODEL || undefined,
    haiku: env.ANTHROPIC_DEFAULT_HAIKU_MODEL || undefined,
  };
}

/**
 * Merge tier mapping into env vars
 */
export function applyTierMapping(
  env: Record<string, string>,
  mapping: { opus?: string; sonnet?: string; haiku?: string }
): Record<string, string> {
  const result = { ...env };

  // Set or remove tier overrides
  if (mapping.opus) {
    result.ANTHROPIC_DEFAULT_OPUS_MODEL = mapping.opus;
  } else {
    delete result.ANTHROPIC_DEFAULT_OPUS_MODEL;
  }

  if (mapping.sonnet) {
    result.ANTHROPIC_DEFAULT_SONNET_MODEL = mapping.sonnet;
  } else {
    delete result.ANTHROPIC_DEFAULT_SONNET_MODEL;
  }

  if (mapping.haiku) {
    result.ANTHROPIC_DEFAULT_HAIKU_MODEL = mapping.haiku;
  } else {
    delete result.ANTHROPIC_DEFAULT_HAIKU_MODEL;
  }

  return result;
}
