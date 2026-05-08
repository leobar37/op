/**
 * Factory Droid API Key Applicator
 *
 * Applies API key profiles to Factory Droid targets by writing model entries
 * to ~/.factory/settings.json via upsertCcsModel.
 */

import { resolveDroidProvider } from '../../../targets/droid-provider';
import { upsertCcsModel } from '../../../droid-settings';
import type { ApiKeyProfile, ApplyApiKeyResult } from '../api-key-types';
import type { TargetApplicatorRecord } from './index';

async function applyDirect(profile: ApiKeyProfile): Promise<ApplyApiKeyResult> {
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

async function applyProxy(profile: ApiKeyProfile): Promise<ApplyApiKeyResult> {
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
      strategy: 'proxy',
      configPath: '~/.factory/settings.json',
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

export const droidApplicator: TargetApplicatorRecord = {
  direct: applyDirect,
  proxy: applyProxy,
  supportedStrategies: ['direct', 'proxy'],
};
