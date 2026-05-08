/**
 * API Key Profile Service
 *
 * CRUD operations for API Key profiles.
 * API Keys are stored in a separate JSON file (~/.ccs/api-keys.json)
 * to avoid triggering the config file watcher.
 *
 * Apply dispatch is delegated to the extensible applicator registry
 * in api-key-applicators/ — each target (claude, droid, pi) registers
 * its own applicator module. No hardcoded if/else branches per target.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getCcsDir } from '../../utils/config-manager';
import { getPresetById } from './provider-presets';
import { dispatchApply } from './api-key-applicators/index';
import type {
  ApiKeyProfile,
  CreateApiKeyInput,
  CreateApiKeyResult,
  RemoveApiKeyResult,
  ApplyApiKeyResult,
  ListApiKeysResult,
} from './api-key-types';
import type { TargetType } from '../../targets/target-adapter';
import type { ApiKeyStrategy } from './api-key-types';

const API_KEYS_FILE = 'api-keys.json';

function getApiKeysFilePath(): string {
  return path.join(getCcsDir(), API_KEYS_FILE);
}

function loadApiKeys(): Record<string, ApiKeyProfile> {
  const filePath = getApiKeysFilePath();
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content) as { profiles?: Record<string, ApiKeyProfile> };
    return data.profiles || {};
  } catch {
    return {};
  }
}

function saveApiKeys(profiles: Record<string, ApiKeyProfile>): void {
  const filePath = getApiKeysFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tempPath = filePath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify({ profiles }, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, filePath);
}

function validateApiKeyId(id: string): string | null {
  if (!id || id.trim().length === 0) {
    return 'API key ID is required';
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
    return 'API key ID must contain only alphanumeric characters, dots, underscores, or hyphens';
  }
  if (id.length > 64) {
    return 'API key ID must be 64 characters or less';
  }
  return null;
}

function resolveBaseUrl(provider: string, providedBaseUrl?: string): string {
  if (providedBaseUrl && providedBaseUrl.trim().length > 0) {
    return providedBaseUrl.trim();
  }
  const preset = getPresetById(provider);
  if (preset?.baseUrl) {
    return preset.baseUrl;
  }
  return '';
}

function resolveDefaultModel(provider: string, providedModel?: string): string {
  if (providedModel && providedModel.trim().length > 0) {
    return providedModel.trim();
  }
  const preset = getPresetById(provider);
  if (preset?.defaultModel) {
    return preset.defaultModel;
  }
  return 'claude-sonnet-4-5';
}

function resolveModels(provider: string, providedModels?: string[]): string[] {
  if (providedModels && providedModels.length > 0) {
    return [...providedModels];
  }
  const preset = getPresetById(provider);
  if (preset) {
    return [preset.defaultModel];
  }
  return ['claude-sonnet-4-5'];
}

/** List all API key profiles */
export function listApiKeyProfiles(): ListApiKeysResult {
  const profiles = loadApiKeys();
  return { profiles: Object.values(profiles) };
}

/** Get a single API key profile by ID */
export function getApiKeyProfile(id: string): ApiKeyProfile | null {
  const profiles = loadApiKeys();
  return profiles[id] || null;
}

/** Check if an API key profile exists */
export function apiKeyProfileExists(id: string): boolean {
  return getApiKeyProfile(id) !== null;
}

/** Create a new API key profile */
export function createApiKeyProfile(input: CreateApiKeyInput): CreateApiKeyResult {
  const idError = validateApiKeyId(input.id);
  if (idError) {
    return { success: false, error: idError };
  }

  if (apiKeyProfileExists(input.id)) {
    return { success: false, error: `API key profile '${input.id}' already exists` };
  }

  if (!input.apiKey || input.apiKey.trim().length === 0) {
    return { success: false, error: 'API key is required' };
  }

  const now = new Date().toISOString();
  const profile: ApiKeyProfile = {
    id: input.id,
    provider: input.provider,
    apiKey: input.apiKey.trim(),
    baseUrl: resolveBaseUrl(input.provider, input.baseUrl),
    defaultModel: resolveDefaultModel(input.provider, input.defaultModel),
    models: resolveModels(input.provider, input.models),
    target: input.target || 'droid',
    createdAt: now,
    updatedAt: now,
  };

  try {
    const profiles = loadApiKeys();
    profiles[input.id] = profile;
    saveApiKeys(profiles);
    return { success: true, profile };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/** Remove an API key profile */
export function removeApiKeyProfile(id: string): RemoveApiKeyResult {
  if (!apiKeyProfileExists(id)) {
    return { success: false, error: `API key profile '${id}' not found` };
  }

  try {
    const profiles = loadApiKeys();
    delete profiles[id];
    saveApiKeys(profiles);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/** Apply an API key profile to a target with a strategy */
export async function applyApiKeyProfile(
  id: string,
  target: TargetType,
  strategy: ApiKeyStrategy
): Promise<ApplyApiKeyResult> {
  const profile = getApiKeyProfile(id);
  if (!profile) {
    return {
      success: false,
      target,
      strategy,
      error: `API key profile '${id}' not found`,
    };
  }

  return dispatchApply(profile, target, strategy);
}
