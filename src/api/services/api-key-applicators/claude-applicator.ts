/**
 * Claude Code API Key Applicator
 *
 * Applies API key profiles to Claude Code targets by writing settings files
 * to ~/.ccs/<id>.settings.json with appropriate environment variables.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getCcsDir } from '../../../utils/config-manager';
import type { ApiKeyProfile, ApplyApiKeyResult } from '../api-key-types';
import type { TargetApplicatorRecord } from './index';

async function applyDirect(profile: ApiKeyProfile): Promise<ApplyApiKeyResult> {
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

async function applyProxy(profile: ApiKeyProfile): Promise<ApplyApiKeyResult> {
  try {
    const ccsDir = getCcsDir();
    const settingsPath = path.join(ccsDir, `${profile.id}.settings.json`);

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

export const claudeApplicator: TargetApplicatorRecord = {
  direct: applyDirect,
  proxy: applyProxy,
  supportedStrategies: ['direct', 'proxy'],
};
