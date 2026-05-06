/**
 * API Key Routes - CRUD operations for API key profiles
 *
 * API key profiles are the source of truth for provider credentials.
 * They can be applied to any target (Droid, Claude) with a chosen strategy (direct, proxy).
 */

import { Router, Request, Response } from 'express';
import {
  listApiKeyProfiles,
  getApiKeyProfile,
  createApiKeyProfile,
  removeApiKeyProfile,
  applyApiKeyProfile,
} from '../../api/services/api-key-service';

import { getPersistedTargetChoices } from '../../targets/target-metadata';
import { parseTarget } from './route-helpers';

const router = Router();

function validatePayloadShape(
  body: unknown,
  allowedKeys: readonly string[]
): { ok: true; payload: Record<string, unknown> } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Request body must be a JSON object' };
  }
  const payload = body as Record<string, unknown>;
  const unknownKeys = Object.keys(payload).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length > 0) {
    return { ok: false, error: `Unknown field(s): ${unknownKeys.join(', ')}` };
  }
  return { ok: true, payload };
}

// ==================== API Key Profile CRUD ====================

/**
 * GET /api/api-keys - List all API key profiles
 */
router.get('/', (_req: Request, res: Response): void => {
  try {
    const result = listApiKeyProfiles();
    // Redact API keys for security
    const profiles = result.profiles.map((p) => ({
      id: p.id,
      provider: p.provider,
      baseUrl: p.baseUrl,
      defaultModel: p.defaultModel,
      models: p.models,
      target: p.target,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
    res.json({ profiles });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/api-keys/:id - Get a single API key profile
 */
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const profile = getApiKeyProfile(req.params.id);
    if (!profile) {
      res.status(404).json({ error: 'API key profile not found' });
      return;
    }
    // Redact API key
    res.json({
      id: profile.id,
      provider: profile.provider,
      baseUrl: profile.baseUrl,
      defaultModel: profile.defaultModel,
      models: profile.models,
      target: profile.target,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/api-keys - Create a new API key profile
 */
router.post('/', (req: Request, res: Response): void => {
  const shape = validatePayloadShape(req.body, [
    'id',
    'provider',
    'apiKey',
    'baseUrl',
    'defaultModel',
    'models',
    'target',
  ]);
  if (!shape.ok) {
    res.status(400).json({ error: shape.error });
    return;
  }

  const { id, provider, apiKey, baseUrl, defaultModel, models, target } = shape.payload;

  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    res.status(400).json({ error: 'id is required' });
    return;
  }
  if (!provider || typeof provider !== 'string' || provider.trim().length === 0) {
    res.status(400).json({ error: 'provider is required' });
    return;
  }
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    res.status(400).json({ error: 'apiKey is required' });
    return;
  }

  const parsedTarget = parseTarget(target);
  if (target !== undefined && parsedTarget === null) {
    res.status(400).json({ error: `Invalid target. Expected: ${getPersistedTargetChoices()}` });
    return;
  }

  const result = createApiKeyProfile({
    id: id.trim(),
    provider: provider.trim(),
    apiKey: apiKey.trim(),
    baseUrl: typeof baseUrl === 'string' ? baseUrl.trim() : undefined,
    defaultModel: typeof defaultModel === 'string' ? defaultModel.trim() : undefined,
    models: Array.isArray(models)
      ? models.filter((m): m is string => typeof m === 'string')
      : undefined,
    target: parsedTarget || undefined,
  });

  if (!result.success || !result.profile) {
    const status = result.error?.includes('already exists') ? 409 : 400;
    res.status(status).json({ error: result.error });
    return;
  }

  const created = result.profile;
  res.status(201).json({
    id: created.id,
    provider: created.provider,
    baseUrl: created.baseUrl,
    defaultModel: created.defaultModel,
    models: created.models,
    target: created.target,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  });
});

/**
 * DELETE /api/api-keys/:id - Remove an API key profile
 */
router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const result = removeApiKeyProfile(req.params.id);
    if (!result.success) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ id: req.params.id, deleted: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ==================== Apply ====================

/**
 * POST /api/api-keys/:id/apply - Apply an API key profile to a target
 */
router.post('/:id/apply', async (req: Request, res: Response): Promise<void> => {
  const shape = validatePayloadShape(req.body, ['target', 'strategy']);
  if (!shape.ok) {
    res.status(400).json({ error: shape.error });
    return;
  }

  const { target, strategy } = shape.payload;

  if (!target || typeof target !== 'string') {
    res.status(400).json({ error: 'target is required' });
    return;
  }

  const parsedTarget = parseTarget(target);
  if (parsedTarget === null) {
    res.status(400).json({ error: `Invalid target. Expected: ${getPersistedTargetChoices()}` });
    return;
  }

  if (!strategy || (strategy !== 'direct' && strategy !== 'proxy')) {
    res.status(400).json({ error: 'strategy must be "direct" or "proxy"' });
    return;
  }

  try {
    const result = await applyApiKeyProfile(req.params.id, parsedTarget, strategy);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({
      id: req.params.id,
      target: result.target,
      strategy: result.strategy,
      configPath: result.configPath,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/api-keys/providers - List available provider presets
 */
router.get('/providers', (_req: Request, res: Response): void => {
  try {
    const presets = [
      {
        id: 'deepseek',
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/anthropic',
        defaultModel: 'deepseek-chat',
      },
      {
        id: 'kimi',
        name: 'Kimi (Moonshot)',
        baseUrl: 'https://api.kimi.com/coding/',
        defaultModel: 'kimi-k2-thinking-turbo',
      },
      {
        id: 'glm',
        name: 'GLM (Z.AI)',
        baseUrl: 'https://api.z.ai/api/anthropic',
        defaultModel: 'glm-5',
      },
      {
        id: 'mm',
        name: 'Minimax',
        baseUrl: 'https://api.minimax.io/anthropic',
        defaultModel: 'MiniMax-M2.1',
      },
      {
        id: 'qwen',
        name: 'Qwen (Alibaba)',
        baseUrl: 'https://dashscope-intl.aliyuncs.com/apps/anthropic',
        defaultModel: 'qwen3-coder-plus',
      },
      {
        id: 'anthropic',
        name: 'Anthropic (Direct)',
        baseUrl: '',
        defaultModel: 'claude-sonnet-4-5-20250929',
      },
      {
        id: 'huggingface',
        name: 'Hugging Face',
        baseUrl: 'https://router.huggingface.co/v1',
        defaultModel: 'openai/gpt-oss-120b:fastest',
      },
      {
        id: 'foundry',
        name: 'Azure Foundry',
        baseUrl: 'https://<your-resource>.services.ai.azure.com/api/anthropic',
        defaultModel: 'claude-sonnet-4-5',
      },
      {
        id: 'novita',
        name: 'Novita AI',
        baseUrl: 'https://api.novita.ai/anthropic',
        defaultModel: 'deepseek/deepseek-v3.2',
      },
    ];
    res.json({ providers: presets });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
