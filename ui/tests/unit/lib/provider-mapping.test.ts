import { describe, expect, it } from 'vitest';
import { resolveDroidProviderForModel } from '@/lib/provider-mapping';

describe('resolveDroidProviderForModel', () => {
  describe('Codex / OpenAI providers', () => {
    it('maps codex provider to openai', () => {
      expect(resolveDroidProviderForModel('codex', 'gpt-5.4')).toBe('openai');
      expect(resolveDroidProviderForModel('codex', 'gpt-5.5')).toBe('openai');
      expect(resolveDroidProviderForModel('codex', 'gpt-5.4-mini')).toBe('openai');
    });

    it('maps gemini provider to openai', () => {
      expect(resolveDroidProviderForModel('gemini', 'gemini-2.5-pro')).toBe('openai');
      expect(resolveDroidProviderForModel('gemini', 'gemini-3.1-pro-preview')).toBe('openai');
    });
  });

  describe('Claude / Anthropic providers', () => {
    it('maps claude provider to anthropic', () => {
      expect(resolveDroidProviderForModel('claude', 'claude-sonnet-4-6')).toBe('anthropic');
      expect(resolveDroidProviderForModel('claude', 'claude-opus-4-7')).toBe('anthropic');
    });

    it('maps agy (Antigravity) provider to anthropic', () => {
      expect(resolveDroidProviderForModel('agy', 'claude-opus-4-6-thinking')).toBe('anthropic');
      expect(resolveDroidProviderForModel('agy', 'claude-sonnet-4-6')).toBe('anthropic');
    });
  });

  describe('Chinese providers', () => {
    it('maps qwen to anthropic', () => {
      expect(resolveDroidProviderForModel('qwen', 'qwen3-coder-plus')).toBe('anthropic');
    });

    it('maps kimi to generic-chat-completion-api', () => {
      expect(resolveDroidProviderForModel('kimi', 'kimi-k2.5')).toBe('generic-chat-completion-api');
      expect(resolveDroidProviderForModel('kimi', 'kimi-k2-thinking')).toBe(
        'generic-chat-completion-api'
      );
    });

    it('falls back to model-based inference for unmapped Chinese providers', () => {
      // deepseek model prefix is not in the model inference list, so falls back to anthropic
      expect(resolveDroidProviderForModel('deepseek', 'deepseek-chat')).toBe('anthropic');
      // glm model prefix is not in the model inference list, so falls back to anthropic
      expect(resolveDroidProviderForModel('glm', 'glm-5')).toBe('anthropic');
    });
  });

  describe('OpenAI-compatible routers', () => {
    it('maps huggingface to generic-chat-completion-api', () => {
      expect(resolveDroidProviderForModel('huggingface', 'openai/gpt-oss-120b')).toBe(
        'generic-chat-completion-api'
      );
    });

    it('maps ollama to generic-chat-completion-api', () => {
      expect(resolveDroidProviderForModel('ollama', 'qwen3-coder')).toBe(
        'generic-chat-completion-api'
      );
    });

    it('maps llamacpp to generic-chat-completion-api', () => {
      expect(resolveDroidProviderForModel('llamacpp', 'llama3-8b')).toBe(
        'generic-chat-completion-api'
      );
    });

    it('maps ollama-cloud to generic-chat-completion-api', () => {
      expect(resolveDroidProviderForModel('ollama-cloud', 'glm-5:cloud')).toBe(
        'generic-chat-completion-api'
      );
    });
  });

  describe('Model-based inference fallback', () => {
    it('infers anthropic from claude- model prefix when provider is unknown', () => {
      expect(resolveDroidProviderForModel('unknown', 'claude-sonnet-4-6')).toBe('anthropic');
    });

    it('infers openai from gpt- model prefix when provider is unknown', () => {
      expect(resolveDroidProviderForModel('unknown', 'gpt-5.4')).toBe('openai');
    });

    it('infers openai from o1/o3/o4 model prefixes when provider is unknown', () => {
      expect(resolveDroidProviderForModel('unknown', 'o1-pro')).toBe('openai');
      expect(resolveDroidProviderForModel('unknown', 'o3-mini')).toBe('openai');
      expect(resolveDroidProviderForModel('unknown', 'o4-preview')).toBe('openai');
    });

    it('falls back to anthropic for unrecognized combinations', () => {
      expect(resolveDroidProviderForModel('unknown', 'some-model')).toBe('anthropic');
      expect(resolveDroidProviderForModel('custom', 'custom-model')).toBe('anthropic');
    });
  });

  describe('Case insensitivity', () => {
    it('handles uppercase provider IDs', () => {
      expect(resolveDroidProviderForModel('CODEX', 'gpt-5.4')).toBe('openai');
      expect(resolveDroidProviderForModel('CLAUDE', 'claude-sonnet-4-6')).toBe('anthropic');
    });

    it('handles mixed-case provider IDs', () => {
      expect(resolveDroidProviderForModel('Codex', 'gpt-5.4')).toBe('openai');
      expect(resolveDroidProviderForModel('Claude', 'claude-sonnet-4-6')).toBe('anthropic');
    });
  });
});
