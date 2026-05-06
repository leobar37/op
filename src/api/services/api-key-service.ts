/**
 * API Key Profile Service
 *
 * CRUD operations for API Key profiles.
 * API Keys are stored in unified config under `api_key_profiles` section.
 * They serve as the source of truth for provider credentials.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  loadOrCreateUnifiedConfig,
  mutateUnifiedConfig,
  isUnifiedMode,
} from '../../config/unified-config-loader';
import { getCcsDir, getConfigPath, loadConfigSafe } from '../../utils/config-manager';
import { resolveDroidProvider } from '../../targets/droid-provider';
import { upsertCcsModel } from '../../droid-settings';
import { getPresetById } from './provider-presets';
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

const API_KEY_PROFILES_SECTION = 'api_key_profiles';

function getApiKeyProfilesSection(config: Record<string, unknown>): Record<string, ApiKeyProfile> {
  return (config[API_KEY_PROFILES_SECTION] as Record<string, ApiKeyProfile>) || {};
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
  if (isUnifiedMode()) {
    const config = loadOrCreateUnifiedConfig();
    const profiles = getApiKeyProfilesSection(config as unknown as Record<string, unknown>);
    return { profiles: Object.values(profiles) };
  }

  // Legacy config support
  const config = loadConfigSafe();
  const profiles = (config as unknown as Record<string, unknown>)[API_KEY_PROFILES_SECTION] as
    | Record<string, ApiKeyProfile>
    | undefined;
  return { profiles: profiles ? Object.values(profiles) : [] };
}

/** Get a single API key profile by ID */
export function getApiKeyProfile(id: string): ApiKeyProfile | null {
  if (isUnifiedMode()) {
    const config = loadOrCreateUnifiedConfig();
    const profiles = getApiKeyProfilesSection(config as unknown as Record<string, unknown>);
    return profiles[id] || null;
  }

  const config = loadConfigSafe();
  const profiles = (config as unknown as Record<string, unknown>)[API_KEY_PROFILES_SECTION] as
    | Record<string, ApiKeyProfile>
    | undefined;
  return profiles?.[id] || null;
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
    if (isUnifiedMode()) {
      mutateUnifiedConfig((config) => {
        const cfg = config as unknown as Record<string, unknown>;
        if (!cfg[API_KEY_PROFILES_SECTION]) {
          cfg[API_KEY_PROFILES_SECTION] = {};
        }
        (cfg[API_KEY_PROFILES_SECTION] as Record<string, ApiKeyProfile>)[input.id] = profile;
      });
    } else {
      const configPath = getConfigPath();
      const config = loadConfigSafe();
      const cfg = config as unknown as Record<string, unknown>;
      if (!cfg[API_KEY_PROFILES_SECTION]) {
        cfg[API_KEY_PROFILES_SECTION] = {};
      }
      (cfg[API_KEY_PROFILES_SECTION] as Record<string, ApiKeyProfile>)[input.id] = profile;

      const tempPath = configPath + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
      fs.renameSync(tempPath, configPath);
    }

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
    if (isUnifiedMode()) {
      mutateUnifiedConfig((config) => {
        const cfg = config as unknown as Record<string, unknown>;
        const profiles = getApiKeyProfilesSection(cfg);
        delete profiles[id];
      });
    } else {
      const configPath = getConfigPath();
      const config = loadConfigSafe();
      const cfg = config as unknown as Record<string, unknown>;
      const profiles = getApiKeyProfilesSection(cfg);
      delete profiles[id];

      const tempPath = configPath + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
      fs.renameSync(tempPath, configPath);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/** Apply an API key profile to Droid with direct strategy */
async function applyToDroidDirect(profile: ApiKeyProfile): Promise<ApplyApiKeyResult> {
  try {
    const droidProvider = resolveDroidProvider({
      baseUrl: profile.baseUrl,
      model: profile.defaultModel,
    });

    await upsertCcsModel(profile.id, {
      model: profile.defaultModel,
      displayName: `CCS ${profile.id}`,
      baseUrl: profile.baseUrl,
      apiKey: profile.apiKey,
      provider: droidProvider,
    });

    return {
      success: true,
      target: 'droid',
      strategy: 'direct',
      configPath: '~/.factory/settings.json',
    };
  } catch (error) {
    return {
      success: false,
      target: 'droid',
      strategy: 'direct',
      error: (error as Error).message,
    };
  }
}

/** Apply an API key profile to Droid with proxy strategy */
async function applyToDroidProxy(_profile: ApiKeyProfile): Promise<ApplyApiKeyResult> {
  // For proxy strategy, we need CLIProxy to manage the route
  // This is a placeholder - full implementation requires cliproxy integration
  try {
    // TODO: Integrate with CLIProxy to create a managed route
    // For now, fall back to direct with a warning
    return {
      success: false,
      target: 'droid',
      strategy: 'proxy',
      error:
        'Proxy strategy for Droid requires CLIProxy route management. Use --strategy direct instead.',
    };
  } catch (error) {
    return {
      success: false,
      target: 'droid',
      strategy: 'proxy',
      error: (error as Error).message,
    };
  }
}

/** Apply an API key profile to Claude with direct strategy */
async function applyToClaudeDirect(profile: ApiKeyProfile): Promise<ApplyApiKeyResult> {
  try {
    const ccsDir = getCcsDir();
    const settingsPath = path.join(ccsDir, `${profile.id}.settings.json`);

    const isNativeAnthropic =
      profile.provider === 'anthropic' ||
      profile.apiKey.startsWith('sk-ant-') ||
      profile.baseUrl.includes('api.anthropic.com');

    const settings = {
      env: isNativeAnthropic
        ? {
            ANTHROPIC_API_KEY: profile.apiKey,
            ANTHROPIC_MODEL: profile.defaultModel,
          }
        : {
            ANTHROPIC_BASE_URL: profile.baseUrl,
            ANTHROPIC_AUTH_TOKEN: profile.apiKey,
            ANTHROPIC_MODEL: profile.defaultModel,
          },
    };

    fs.mkdirSync(ccsDir, { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');

    return {
      success: true,
      target: 'claude',
      strategy: 'direct',
      configPath: settingsPath,
    };
  } catch (error) {
    return {
      success: false,
      target: 'claude',
      strategy: 'direct',
      error: (error as Error).message,
    };
  }
}

/** Apply an API key profile to Claude with proxy strategy */
async function applyToClaudeProxy(profile: ApiKeyProfile): Promise<ApplyApiKeyResult> {
  // For proxy strategy, we use the existing API profile mechanism
  try {
    const ccsDir = getCcsDir();
    const settingsPath = path.join(ccsDir, `${profile.id}.settings.json`);

    // Create a settings file that will be used by the proxy
    const settings = {
      env: {
        ANTHROPIC_BASE_URL: profile.baseUrl,
        ANTHROPIC_AUTH_TOKEN: profile.apiKey,
        ANTHROPIC_MODEL: profile.defaultModel,
      },
    };

    fs.mkdirSync(ccsDir, { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');

    return {
      success: true,
      target: 'claude',
      strategy: 'proxy',
      configPath: settingsPath,
    };
  } catch (error) {
    return {
      success: false,
      target: 'claude',
      strategy: 'proxy',
      error: (error as Error).message,
    };
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

  if (target === 'droid') {
    return strategy === 'direct' ? applyToDroidDirect(profile) : applyToDroidProxy(profile);
  }

  if (target === 'claude') {
    return strategy === 'direct' ? applyToClaudeDirect(profile) : applyToClaudeProxy(profile);
  }

  return {
    success: false,
    target,
    strategy,
    error: `Target '${target}' is not supported for API key application`,
  };
}
