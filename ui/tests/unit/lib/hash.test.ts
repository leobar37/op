import { describe, expect, it } from 'vitest';
import { computeModelHash } from '@/lib/hash';

describe('computeModelHash', () => {
  it('produces deterministic hashes for identical entries', async () => {
    const entry = {
      model: 'gemini-2.5-pro',
      id: 'custom:GEMINI:gemini-2.5-pro',
      index: 0,
      baseUrl: 'http://127.0.0.1:8317/api/provider/gemini',
      apiKey: 'ccs-internal-managed',
      displayName: 'gemini-2.5-pro',
      noImageSupport: false,
      provider: 'openai',
    };

    const hash1 = await computeModelHash(entry);
    const hash2 = await computeModelHash(entry);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(12);
    expect(hash1).toMatch(/^[a-f0-9]{12}$/);
  });

  it('produces different hashes for different entries', async () => {
    const entry1 = {
      model: 'gemini-2.5-pro',
      id: 'custom:GEMINI:gemini-2.5-pro',
      index: 0,
      baseUrl: 'http://127.0.0.1:8317/api/provider/gemini',
      apiKey: 'ccs-internal-managed',
      displayName: 'gemini-2.5-pro',
      noImageSupport: false,
      provider: 'openai',
    };

    const entry2 = {
      ...entry1,
      displayName: 'gemini-2.5-pro-modified',
    };

    const hash1 = await computeModelHash(entry1);
    const hash2 = await computeModelHash(entry2);
    expect(hash1).not.toBe(hash2);
  });

  it('is insensitive to key ordering', async () => {
    const entryA = {
      model: 'claude-opus-4',
      provider: 'anthropic',
      baseUrl: 'http://127.0.0.1:8317/api/provider/claude',
      apiKey: 'test-key',
      displayName: 'Claude Opus',
      noImageSupport: false,
      id: 'custom:CLAUDE:claude-opus-4',
      index: 0,
    };

    const entryB = {
      id: 'custom:CLAUDE:claude-opus-4',
      index: 0,
      model: 'claude-opus-4',
      provider: 'anthropic',
      baseUrl: 'http://127.0.0.1:8317/api/provider/claude',
      apiKey: 'test-key',
      displayName: 'Claude Opus',
      noImageSupport: false,
    };

    const hashA = await computeModelHash(entryA);
    const hashB = await computeModelHash(entryB);
    expect(hashA).toBe(hashB);
  });

  it('matches expected server-side hash for known entry', async () => {
    // With the mocked crypto.subtle.digest, this entry produces a deterministic hash.
    // The mock XOR-folds bytes into 32 bytes, then we take first 12 hex chars.
    const entry = {
      apiKey: 'ccs-internal-managed',
      baseUrl: 'http://127.0.0.1:8317/api/provider/gemini',
      displayName: 'gemini-2.5-pro',
      id: 'custom:GEMINI:gemini-2.5-pro',
      index: 0,
      model: 'gemini-2.5-pro',
      noImageSupport: false,
      provider: 'openai',
    };

    const hash = await computeModelHash(entry);
    // Deterministic hash from mocked crypto.subtle.digest
    expect(hash).toBe('6a0809212a39');
  });
});
