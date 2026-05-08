/**
 * API Key Applicator Tests
 *
 * Tests the extensible target applicator registry and all target applicators:
 * Claude (direct/proxy), Droid (direct/proxy), Pi (direct only).
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it, afterAll } from 'bun:test';
import { createTestEnvironment } from '../../shared/fixtures/test-environment';
import { dispatchApply, getApplicatorRecord, getSupportedApplyTargets } from '../../../src/api/services/api-key-applicators/index';
import { createApiKeyProfile, removeApiKeyProfile } from '../../../src/api/services/api-key-service';
import { resolveDroidConfigPaths } from '../../../src/droid-settings/paths';
import type { ApiKeyProfile } from '../../../src/api/services/api-key-types';

// ==================== Helper: create test profiles ====================

function createMinimalProfile(overrides: Partial<ApiKeyProfile> = {}): ApiKeyProfile {
  return {
    id: 'test-profile',
    provider: 'deepseek',
    apiKey: 'sk-test-key-12345',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat'],
    target: 'droid',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ==================== Registry Tests ====================

describe('applicator registry', () => {
  it('returns applicator record for claude', () => {
    const record = getApplicatorRecord('claude');
    expect(record).not.toBeNull();
    expect(record!.supportedStrategies).toEqual(['direct', 'proxy']);
  });

  it('returns applicator record for droid', () => {
    const record = getApplicatorRecord('droid');
    expect(record).not.toBeNull();
    expect(record!.supportedStrategies).toEqual(['direct', 'proxy']);
  });

  it('returns applicator record for pi', () => {
    const record = getApplicatorRecord('pi');
    expect(record).not.toBeNull();
    expect(record!.supportedStrategies).toEqual(['direct']);
  });

  it('returns null for unknown target', () => {
    const record = getApplicatorRecord('unknown' as never);
    expect(record).toBeNull();
  });

  it('lists supported apply targets', () => {
    const targets = getSupportedApplyTargets();
    expect(targets).toContain('claude');
    expect(targets).toContain('droid');
    expect(targets).toContain('pi');
  });
});

describe('dispatchApply', () => {
  it('returns error for unknown target', async () => {
    const profile = createMinimalProfile();
    const result = await dispatchApply(profile, 'codex' as never, 'direct');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not supported');
  });

  it('returns error for unknown strategy', async () => {
    const profile = createMinimalProfile();
    const result = await dispatchApply(profile, 'droid', 'unknown' as never);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not supported');
  });

  it('returns error for unsupported strategy on pi', async () => {
    const profile = createMinimalProfile();
    const result = await dispatchApply(profile, 'pi', 'proxy');
    expect(result.success).toBe(false);
    expect(result.target).toBe('pi');
    expect(result.strategy).toBe('proxy');
    expect(result.error).toContain('not supported');
  });
});

// ==================== Claude Applicator Tests ====================

describe('Claude applicator', () => {
  const env = createTestEnvironment();

  afterAll(() => {
    env.cleanup();
  });

  it('applies direct strategy to claude target', async () => {
    const profile = createMinimalProfile();
    const result = await dispatchApply(profile, 'claude', 'direct');

    expect(result.success).toBe(true);
    expect(result.target).toBe('claude');
    expect(result.strategy).toBe('direct');
    expect(result.configPath).toBeString();
    expect(fs.existsSync(result.configPath!)).toBe(true);

    const content = JSON.parse(fs.readFileSync(result.configPath!, 'utf8'));
    expect(content.env.ANTHROPIC_AUTH_TOKEN).toBe('sk-test-key-12345');
    expect(content.env.ANTHROPIC_BASE_URL).toBe('https://api.deepseek.com/v1');
  });

  it('applies direct strategy with native anthropic key', async () => {
    const profile = createMinimalProfile({
      provider: 'anthropic',
      apiKey: 'sk-ant-test-key-123',
      baseUrl: 'https://api.anthropic.com',
    });
    const result = await dispatchApply(profile, 'claude', 'direct');

    expect(result.success).toBe(true);
    const content = JSON.parse(fs.readFileSync(result.configPath!, 'utf8'));
    expect(content.env.ANTHROPIC_API_KEY).toBe('sk-ant-test-key-123');
    expect(content.env.ANTHROPIC_BASE_URL).toBeUndefined();
  });

  it('applies proxy strategy to claude target', async () => {
    const profile = createMinimalProfile();
    const result = await dispatchApply(profile, 'claude', 'proxy');

    expect(result.success).toBe(true);
    expect(result.target).toBe('claude');
    expect(result.strategy).toBe('proxy');
    expect(result.configPath).toBeString();
    expect(fs.existsSync(result.configPath!)).toBe(true);

    const content = JSON.parse(fs.readFileSync(result.configPath!, 'utf8'));
    expect(content.env.ANTHROPIC_AUTH_TOKEN).toBe('sk-test-key-12345');
    expect(content.env.ANTHROPIC_BASE_URL).toBe('https://api.deepseek.com/v1');
  });
});

// ==================== Droid Applicator Tests ====================

describe('Droid applicator', () => {
  const env = createTestEnvironment();

  afterAll(() => {
    env.cleanup();
  });

  it('applies direct strategy to droid target', async () => {
    const profile = createMinimalProfile();
    const result = await dispatchApply(profile, 'droid', 'direct');

    expect(result.success).toBe(true);
    expect(result.target).toBe('droid');
    expect(result.strategy).toBe('direct');
    expect(result.configPath).toBe('~/.factory/settings.json');
  });

  it('applies proxy strategy to droid target', async () => {
    const profile = createMinimalProfile();
    const result = await dispatchApply(profile, 'droid', 'proxy');

    expect(result.success).toBe(true);
    expect(result.target).toBe('droid');
    expect(result.strategy).toBe('proxy');
    expect(result.configPath).toBe('~/.factory/settings.json');
  });

  it('writes model to factory settings.json', async () => {
    const profile = createMinimalProfile({ id: 'test-deepseek' });
    const result = await dispatchApply(profile, 'droid', 'direct');

    expect(result.success).toBe(true);

    // Verify the model was written to factory settings
    const droidPaths = resolveDroidConfigPaths();
    const factorySettingsPath = droidPaths.settingsPath;
    expect(fs.existsSync(factorySettingsPath)).toBe(true);

    const settings = JSON.parse(fs.readFileSync(factorySettingsPath, 'utf8'));
    const modelEntry = settings.customModels?.find(
      (m: { displayName: string }) => m.displayName === 'CCS test-deepseek'
    );
    expect(modelEntry).toBeDefined();
    expect(modelEntry.baseUrl).toBe('https://api.deepseek.com/v1');
    expect(modelEntry.apiKey).toBe('sk-test-key-12345');
  });
});

// ==================== Pi Applicator Tests ====================

describe('Pi applicator', () => {
  const env = createTestEnvironment();
  const originalPiHome = process.env.PI_HOME;

  afterAll(() => {
    env.cleanup();
    if (originalPiHome !== undefined) {
      process.env.PI_HOME = originalPiHome;
    } else {
      delete process.env.PI_HOME;
    }
  });

  it('applies direct strategy to pi target and writes auth.json', async () => {
    // Point PI_HOME to a temp directory for isolation
    const piHome = path.join(env.testHome, '.pi-test');
    process.env.PI_HOME = piHome;

    const profile = createMinimalProfile({ provider: 'deepseek' });
    const result = await dispatchApply(profile, 'pi', 'direct');

    expect(result.success).toBe(true);
    expect(result.target).toBe('pi');
    expect(result.strategy).toBe('direct');
    expect(result.configPath).toBe('~/.pi/agent/auth.json');

    // Verify the auth.json was written
    const authPath = path.join(piHome, 'agent', 'auth.json');
    expect(fs.existsSync(authPath)).toBe(true);

    const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    expect(auth.deepseek).toBeDefined();
    expect(auth.deepseek.type).toBe('api_key');
    expect(auth.deepseek.key).toBe('sk-test-key-12345');
  });

  it('rejects proxy strategy for pi target', async () => {
    const profile = createMinimalProfile({ provider: 'deepseek' });
    const result = await dispatchApply(profile, 'pi', 'proxy');

    expect(result.success).toBe(false);
    expect(result.target).toBe('pi');
    expect(result.strategy).toBe('proxy');
    expect(result.error).toContain('not supported');
    expect(result.error).toContain('pi');
  });

  it('returns error for unsupported CCS provider for pi', async () => {
    const profile = createMinimalProfile({ provider: 'ollama' });
    const result = await dispatchApply(profile, 'pi', 'direct');

    expect(result.success).toBe(false);
    expect(result.target).toBe('pi');
    expect(result.strategy).toBe('direct');
    expect(result.error).toContain('Unsupported');
    expect(result.error).toContain('ollama');
  });

  it('maps supported providers to correct Pi auth provider key', async () => {
    const piHome = path.join(env.testHome, '.pi-test-2');
    process.env.PI_HOME = piHome;

    const testCases = [
      { provider: 'glm', expectedKey: 'anthropic' },
      { provider: 'qwen', expectedKey: 'anthropic' },
      { provider: 'mm', expectedKey: 'minimax' },
      { provider: 'novita', expectedKey: 'anthropic' },
    ];

    for (const { provider, expectedKey } of testCases) {
      const profile = createMinimalProfile({
        id: `test-${provider}`,
        provider,
        apiKey: `sk-${provider}-test-key`,
      });
      const result = await dispatchApply(profile, 'pi', 'direct');
      expect(result.success).toBe(true);

      const authPath = path.join(piHome, 'agent', 'auth.json');
      const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
      expect(auth[expectedKey]).toBeDefined();
      expect(auth[expectedKey].type).toBe('api_key');
      expect(auth[expectedKey].key).toBe(`sk-${provider}-test-key`);
    }
  });
});

// ==================== Integration: applyApiKeyProfile ====================

describe('applyApiKeyProfile integration', () => {
  const env = createTestEnvironment();

  afterAll(() => {
    // Clean up any created profiles
    try {
      removeApiKeyProfile('integration-test-profile');
    } catch {
      // ignore
    }
    env.cleanup();
  });

  it('creates and applies a profile to claude', async () => {
    // Create a profile first
    const createResult = createApiKeyProfile({
      id: 'integration-test-profile',
      provider: 'deepseek',
      apiKey: 'sk-integration-test-key',
    });
    expect(createResult.success).toBe(true);

    // Apply it through the service
    const { applyApiKeyProfile } = await import('../../../src/api/services/api-key-service');
    const result = await applyApiKeyProfile('integration-test-profile', 'claude', 'direct');

    expect(result.success).toBe(true);
    expect(result.target).toBe('claude');
    expect(result.strategy).toBe('direct');
    expect(fs.existsSync(result.configPath!)).toBe(true);
  });

  it('returns error for unknown profile', async () => {
    const { applyApiKeyProfile } = await import('../../../src/api/services/api-key-service');
    const result = await applyApiKeyProfile('nonexistent-profile', 'droid', 'direct');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});
