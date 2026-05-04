const AMBIENT_PROVIDER_PREFIXES = [
  'ANTHROPIC_',
  'OPENAI_',
  'GOOGLE_',
  'GEMINI_',
  'MINIMAX_',
  'QWEN_',
  'DEEPSEEK_',
  'KIMI_',
  'AZURE_',
  'OLLAMA_',
  'XAI_',
  'MISTRAL_',
  'COHERE_',
  'PERPLEXITY_',
  'TOGETHER_',
  'FIREWORKS_',
];
const AMBIENT_PROVIDER_EXACT_KEYS = new Set(['XAI_API_KEY', 'MISTRAL_API_KEY', 'COHERE_API_KEY']);
const AMBIENT_PROVIDER_SUFFIXES = [
  '_API_KEY',
  '_AUTH_TOKEN',
  '_ACCESS_TOKEN',
  '_SECRET_KEY',
  '_API_TOKEN',
  '_BEARER_TOKEN',
  '_SESSION_TOKEN',
];

export function stripAmbientProviderCredentials(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const sanitized: NodeJS.ProcessEnv = { ...env };

  for (const envKey of Object.keys(sanitized)) {
    const normalizedKey = envKey.toUpperCase();

    if (normalizedKey === 'CLAUDE_CONFIG_DIR') {
      continue;
    }

    if (
      AMBIENT_PROVIDER_PREFIXES.some((prefix) => normalizedKey.startsWith(prefix)) ||
      AMBIENT_PROVIDER_EXACT_KEYS.has(normalizedKey) ||
      AMBIENT_PROVIDER_SUFFIXES.some((suffix) => normalizedKey.endsWith(suffix))
    ) {
      delete sanitized[envKey];
    }
  }

  return sanitized;
}
