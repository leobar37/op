/**
 * Unit tests for Pi auth.json read/write and provider mapping.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  readPiAuth,
  readPiAuthSync,
  writePiAuth,
  writePiAuthSync,
  mergePiAuth,
  mergePiAuthSync,
  removePiAuthProviders,
  removePiAuthProvidersSync,
  redactAuthEntry,
  redactAuthStore,
  readRaw,
  readRawSync,
  writeRaw,
  writeRawSync,
  mapCcsProviderToPiAuthProvider,
  getSupportedCcsProviderIds,
  getSupportedPiAuthProviderKeys,
  isSupportedCcsProviderForPi,
} from '../../../src/pi-settings';

describe('pi-settings', () => {
  let tmpDir: string;
  let originalPiHome: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-pi-test-'));
    originalPiHome = process.env.PI_HOME;
    process.env.PI_HOME = tmpDir;
  });

  afterEach(() => {
    if (originalPiHome !== undefined) {
      process.env.PI_HOME = originalPiHome;
    } else {
      delete process.env.PI_HOME;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('readPiAuth', () => {
    it('should return empty object when auth.json does not exist', async () => {
      const store = await readPiAuth();
      expect(store).toEqual({});
    });

    it('should read existing auth.json', async () => {
      const agentDir = path.join(tmpDir, 'agent');
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(
        path.join(agentDir, 'auth.json'),
        JSON.stringify({
          anthropic: { type: 'api_key', key: 'sk-ant-xxx' },
          openai: { type: 'api_key', key: 'sk-xxx' },
        })
      );

      const store = await readPiAuth();
      expect(store).toEqual({
        anthropic: { type: 'api_key', key: 'sk-ant-xxx' },
        openai: { type: 'api_key', key: 'sk-xxx' },
      });
    });

    it('should reject symlinked auth.json', async () => {
      const agentDir = path.join(tmpDir, 'agent');
      fs.mkdirSync(agentDir, { recursive: true });
      const realAuth = path.join(agentDir, 'real-auth.json');
      fs.writeFileSync(realAuth, '{}');
      fs.symlinkSync(realAuth, path.join(agentDir, 'auth.json'));

      expect(() => readPiAuthSync()).toThrow(/auth\.json is a symlink/);
    });

    it('should recover from corrupted JSON by backing up', async () => {
      const agentDir = path.join(tmpDir, 'agent');
      fs.mkdirSync(agentDir, { recursive: true });
      const authPath = path.join(agentDir, 'auth.json');
      fs.writeFileSync(authPath, '{"providers":[', 'utf8');

      const store = await readPiAuth();
      expect(store).toEqual({});
      expect(fs.existsSync(`${authPath}.bak`)).toBe(true);
    });

    it('should ignore invalid entries and keep valid ones', async () => {
      const agentDir = path.join(tmpDir, 'agent');
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(
        path.join(agentDir, 'auth.json'),
        JSON.stringify({
          anthropic: { type: 'api_key', key: 'valid' },
          bad: { type: 'api_key' },
          alsoBad: { type: 'unknown', key: 'x' },
        })
      );

      const store = await readPiAuth();
      expect(Object.keys(store)).toHaveLength(1);
      expect(store.anthropic).toEqual({ type: 'api_key', key: 'valid' });
    });
  });

  describe('writePiAuth', () => {
    it('should create auth.json with restricted permissions', async () => {
      await writePiAuth({
        anthropic: { type: 'api_key', key: 'secret' },
      });

      const authPath = path.join(tmpDir, 'agent', 'auth.json');
      expect(fs.existsSync(authPath)).toBe(true);

      const stat = fs.statSync(authPath);
      // eslint-disable-next-line no-bitwise
      const otherPerms = stat.mode & 0o077;
      expect(otherPerms).toBe(0);
    });

    it('should write valid JSON', async () => {
      await writePiAuth({
        anthropic: { type: 'api_key', key: 'sk-ant-xxx' },
      });

      const authPath = path.join(tmpDir, 'agent', 'auth.json');
      const content = JSON.parse(fs.readFileSync(authPath, 'utf8'));
      expect(content).toEqual({
        anthropic: { type: 'api_key', key: 'sk-ant-xxx' },
      });
    });

    it('should reject symlinked auth.json on write', async () => {
      const agentDir = path.join(tmpDir, 'agent');
      fs.mkdirSync(agentDir, { recursive: true });
      const realAuth = path.join(agentDir, 'real-auth.json');
      fs.writeFileSync(realAuth, '{}');
      fs.symlinkSync(realAuth, path.join(agentDir, 'auth.json'));

      expect(() =>
        writePiAuthSync({
          anthropic: { type: 'api_key', key: 'x' },
        })
      ).toThrow(/auth\.json is a symlink/);
    });

    it('should reject symlinked temp file', async () => {
      const agentDir = path.join(tmpDir, 'agent');
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(path.join(agentDir, 'auth.json'), '{}');
      fs.symlinkSync('/tmp', path.join(agentDir, 'auth.json.tmp'));

      expect(() =>
        writePiAuthSync({
          anthropic: { type: 'api_key', key: 'x' },
        })
      ).toThrow(/auth\.json\.tmp is a symlink/);
    });
  });

  describe('mergePiAuth', () => {
    it('should merge entries preserving existing ones', async () => {
      const agentDir = path.join(tmpDir, 'agent');
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(
        path.join(agentDir, 'auth.json'),
        JSON.stringify({
          anthropic: { type: 'api_key', key: 'old-key' },
          openai: { type: 'api_key', key: 'openai-key' },
        })
      );

      const merged = await mergePiAuth({
        anthropic: { type: 'api_key', key: 'new-key' },
        deepseek: { type: 'api_key', key: 'deepseek-key' },
      });

      expect(merged.anthropic).toEqual({ type: 'api_key', key: 'new-key' });
      expect(merged.openai).toEqual({ type: 'api_key', key: 'openai-key' });
      expect(merged.deepseek).toEqual({ type: 'api_key', key: 'deepseek-key' });
    });

    it('should create auth.json when none exists', async () => {
      const merged = await mergePiAuth({
        anthropic: { type: 'api_key', key: 'key' },
      });

      expect(merged.anthropic).toEqual({ type: 'api_key', key: 'key' });
    });
  });

  describe('removePiAuthProviders', () => {
    it('should remove specified providers preserving others', async () => {
      const agentDir = path.join(tmpDir, 'agent');
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(
        path.join(agentDir, 'auth.json'),
        JSON.stringify({
          anthropic: { type: 'api_key', key: 'key1' },
          openai: { type: 'api_key', key: 'key2' },
          deepseek: { type: 'api_key', key: 'key3' },
        })
      );

      const updated = await removePiAuthProviders(['anthropic', 'deepseek']);
      expect(Object.keys(updated)).toHaveLength(1);
      expect(updated.openai).toEqual({ type: 'api_key', key: 'key2' });
    });

    it('should handle removing non-existent providers', async () => {
      const agentDir = path.join(tmpDir, 'agent');
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(
        path.join(agentDir, 'auth.json'),
        JSON.stringify({
          anthropic: { type: 'api_key', key: 'key' },
        })
      );

      const updated = await removePiAuthProviders(['nonexistent']);
      expect(Object.keys(updated)).toHaveLength(1);
      expect(updated.anthropic).toEqual({ type: 'api_key', key: 'key' });
    });
  });

  describe('redactAuthEntry', () => {
    it('should redact api_key entry', () => {
      const redacted = redactAuthEntry({ type: 'api_key', key: 'sk-ant-xxx1234' });
      expect(redacted.type).toBe('api_key');
      expect(redacted.key).toBe('sk-a...1234');
    });

    it('should redact short api_key as ****', () => {
      const redacted = redactAuthEntry({ type: 'api_key', key: 'short' });
      expect(redacted.key).toBe('****');
    });

    it('should redact oauth entry without tokens', () => {
      const redacted = redactAuthEntry({ type: 'oauth', access_token: 'secret' });
      expect(redacted.type).toBe('oauth');
      expect(redacted.key).toBeUndefined();
    });
  });

  describe('redactAuthStore', () => {
    it('should redact all entries in store', () => {
      const store = {
        anthropic: { type: 'api_key' as const, key: 'sk-ant-very-long-secret-key' },
        openai: { type: 'api_key' as const, key: 'sk-short' },
        google: { type: 'oauth' as const, access_token: 'token' },
      };

      const redacted = redactAuthStore(store);
      expect(redacted.anthropic.key).toBe('sk-a...-key');
      expect(redacted.openai.key).toBe('****');
      expect(redacted.google.type).toBe('oauth');
      expect(redacted.google.key).toBeUndefined();
    });
  });

  describe('readRaw / writeRaw', () => {
    it('should read raw text and mtime', async () => {
      const agentDir = path.join(tmpDir, 'agent');
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(path.join(agentDir, 'auth.json'), '{"x":1}');

      const result = await readRaw();
      expect(result.text).toBe('{"x":1}');
      expect(typeof result.mtime).toBe('number');
    });

    it('should write raw text with mtime check', async () => {
      const agentDir = path.join(tmpDir, 'agent');
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(path.join(agentDir, 'auth.json'), '{"x":1}');

      const { mtime } = await readRaw();
      const result = await writeRaw('{"y":2}', mtime);
      expect(typeof result.mtime).toBe('number');

      const content = fs.readFileSync(path.join(agentDir, 'auth.json'), 'utf8');
      expect(JSON.parse(content)).toEqual({ y: 2 });
    });

    it('should reject invalid JSON', async () => {
      await expect(writeRaw('not json', undefined)).rejects.toThrow(/Invalid JSON/);
    });

    it('should reject non-object JSON root', async () => {
      await expect(writeRaw('[1,2,3]', undefined)).rejects.toThrow(/JSON root must be an object/);
    });

    it('should reject write when file modified externally', async () => {
      const agentDir = path.join(tmpDir, 'agent');
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(path.join(agentDir, 'auth.json'), '{"x":1}');

      const { mtime } = await readRaw();
      // Wait to ensure mtime differs
      await new Promise((r) => setTimeout(r, 1100));
      fs.writeFileSync(path.join(agentDir, 'auth.json'), '{"x":2}');

      await expect(writeRaw('{"y":3}', mtime)).rejects.toThrow(/File modified externally/);
    });
  });

  describe('provider mapping', () => {
    it('should map canonical CCS providers to Pi providers', () => {
      expect(mapCcsProviderToPiAuthProvider('anthropic')).toBe('anthropic');
      expect(mapCcsProviderToPiAuthProvider('deepseek')).toBe('deepseek');
      expect(mapCcsProviderToPiAuthProvider('glm')).toBe('anthropic');
      expect(mapCcsProviderToPiAuthProvider('km')).toBe('kimi-coding');
      expect(mapCcsProviderToPiAuthProvider('mm')).toBe('minimax');
      expect(mapCcsProviderToPiAuthProvider('qwen')).toBe('anthropic');
      expect(mapCcsProviderToPiAuthProvider('novita')).toBe('anthropic');
      expect(mapCcsProviderToPiAuthProvider('foundry')).toBe('anthropic');
    });

    it('should map aliases to Pi providers', () => {
      expect(mapCcsProviderToPiAuthProvider('kimi')).toBe('kimi-coding');
      expect(mapCcsProviderToPiAuthProvider('hf')).toBe('openai');
    });

    it('should throw for unsupported local providers', () => {
      expect(() => mapCcsProviderToPiAuthProvider('ollama')).toThrow(/does not use API keys/);
    });

    it('should throw for unknown providers', () => {
      expect(() => mapCcsProviderToPiAuthProvider('unknown-provider')).toThrow(
        /Unsupported CCS provider/
      );
    });

    it('should list supported CCS provider IDs', () => {
      const ids = getSupportedCcsProviderIds();
      expect(ids).toContain('anthropic');
      expect(ids).toContain('deepseek');
      expect(ids).toContain('glm');
      expect(ids).toContain('km');
    });

    it('should list supported Pi auth provider keys', () => {
      const keys = getSupportedPiAuthProviderKeys();
      expect(keys).toContain('anthropic');
      expect(keys).toContain('openai');
      expect(keys).toContain('deepseek');
      expect(keys).toContain('kimi-coding');
      expect(keys).toContain('minimax');
    });

    it('should check supported providers', () => {
      expect(isSupportedCcsProviderForPi('anthropic')).toBe(true);
      expect(isSupportedCcsProviderForPi('deepseek')).toBe(true);
      expect(isSupportedCcsProviderForPi('unknown')).toBe(false);
    });
  });

  describe('concurrent writes', () => {
    it('should handle concurrent merges without data loss', async () => {
      await writePiAuth({});

      const providers = Array.from({ length: 10 }, (_, i) => `provider-${i}`);
      await Promise.all(
        providers.map((p) =>
          mergePiAuth({
            [p]: { type: 'api_key', key: `key-${p}` },
          })
        )
      );

      const store = await readPiAuth();
      expect(Object.keys(store)).toHaveLength(10);
      for (const p of providers) {
        expect(store[p]).toEqual({ type: 'api_key', key: `key-${p}` });
      }
    }, 15000);
  });
});
