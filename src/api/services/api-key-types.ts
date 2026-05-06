/**
 * API Key Profile Types
 *
 * Types for the API Keys section - source of truth for provider credentials.
 * Each API Key stores credentials for a provider and can be applied to any target
 * with a chosen strategy (direct or proxy).
 */

import type { TargetType } from '../../targets/target-adapter';

/** Supported API key providers */
export type ApiKeyProvider =
  | 'deepseek'
  | 'kimi'
  | 'glm'
  | 'mm'
  | 'qwen'
  | 'anthropic'
  | 'huggingface'
  | 'ollama'
  | 'llamacpp'
  | 'foundry'
  | 'ollama-cloud'
  | 'novita'
  | string;

/** Routing strategy when applying an API key */
export type ApiKeyStrategy = 'direct' | 'proxy';

/** API Key profile stored in config */
export interface ApiKeyProfile {
  /** Unique identifier (user-defined, e.g., "deepseek-prod") */
  id: string;
  /** Provider name */
  provider: ApiKeyProvider;
  /** API key credential */
  apiKey: string;
  /** Base URL for the provider (configurable) */
  baseUrl: string;
  /** Default model for this provider */
  defaultModel: string;
  /** Supported models */
  models: string[];
  /** Default target when applying */
  target: TargetType;
  /** ISO timestamp when created */
  createdAt: string;
  /** ISO timestamp when last updated */
  updatedAt: string;
}

/** Result from create operation */
export interface CreateApiKeyResult {
  success: boolean;
  profile?: ApiKeyProfile;
  error?: string;
}

/** Result from remove operation */
export interface RemoveApiKeyResult {
  success: boolean;
  error?: string;
}

/** Result from apply operation */
export interface ApplyApiKeyResult {
  success: boolean;
  target: TargetType;
  strategy: ApiKeyStrategy;
  configPath?: string;
  error?: string;
}

/** Result from list operation */
export interface ListApiKeysResult {
  profiles: ApiKeyProfile[];
}

/** Input for creating an API key profile */
export interface CreateApiKeyInput {
  id: string;
  provider: ApiKeyProvider;
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  models?: string[];
  target?: TargetType;
}

/** Input for applying an API key profile */
export interface ApplyApiKeyInput {
  id: string;
  target: TargetType;
  strategy: ApiKeyStrategy;
}
