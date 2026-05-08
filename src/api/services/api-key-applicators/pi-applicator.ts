/**
 * Pi Coding Agent API Key Applicator
 *
 * Applies API key profiles to Pi targets by writing auth entries
 * to ~/.pi/agent/auth.json via mergePiAuth.
 *
 * Pi only supports the 'direct' strategy initially.
 * Proxy strategy is rejected with a clear error.
 */

import {
  mapCcsProviderToPiAuthProvider,
  isSupportedCcsProviderForPi,
} from '../../../pi-settings/provider-mapping';
import { mergePiAuth } from '../../../pi-settings/auth';
import type { ApiKeyProfile, ApplyApiKeyResult } from '../api-key-types';
import type { TargetApplicatorRecord } from './index';

async function applyDirect(profile: ApiKeyProfile): Promise<ApplyApiKeyResult> {
  try {
    // Validate that the CCS provider is supported for Pi auth mapping
    if (!isSupportedCcsProviderForPi(profile.provider)) {
      const supported = [
        'anthropic',
        'deepseek',
        'glm',
        'km',
        'kimi',
        'mm',
        'qwen',
        'novita',
        'foundry',
        'hf',
      ];
      return {
        success: false,
        target: 'pi',
        strategy: 'direct',
        error: `Unsupported CCS provider "${profile.provider}" for Pi. Supported providers: ${supported.join(', ')}`,
      };
    }

    const piProviderKey = mapCcsProviderToPiAuthProvider(profile.provider);

    await mergePiAuth({
      [piProviderKey]: {
        type: 'api_key',
        key: profile.apiKey,
      },
    });

    return {
      success: true,
      target: 'pi',
      strategy: 'direct',
      configPath: '~/.pi/agent/auth.json',
    };
  } catch (error) {
    return {
      success: false,
      target: 'pi',
      strategy: 'direct',
      error: (error as Error).message,
    };
  }
}

async function applyProxy(_profile: ApiKeyProfile): Promise<ApplyApiKeyResult> {
  return {
    success: false,
    target: 'pi',
    strategy: 'proxy',
    error: 'Proxy strategy is not supported for Pi target. Use "direct" strategy instead.',
  };
}

export const piApplicator: TargetApplicatorRecord = {
  direct: applyDirect,
  proxy: applyProxy,
  supportedStrategies: ['direct'],
};
