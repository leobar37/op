/**
 * CLIProxy Providers Routes - Global provider view with model catalog
 * Returns provider cards data and model lists for Droid/CLI integration
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import {
  getAllAuthStatus,
  getOAuthConfig,
  initializeAccounts,
} from '../../cliproxy/auth/auth-handler';
import { fetchRemoteAuthStatus } from '../../cliproxy/services/remote-auth-fetcher';
import { fetchCliproxyModels } from '../../cliproxy/services/stats-fetcher';
import { isCliproxyRunning } from '../../cliproxy/services/stats-fetcher';
import { getProxyTarget } from '../../cliproxy/proxy/proxy-target-resolver';
import { requireLocalAccessWhenAuthDisabled } from '../middleware/auth-middleware';
import { CLIPROXY_PROFILES } from '../../auth/profile-detector';
import { MODEL_CATALOG } from '../../cliproxy/model-catalog';
import { PROVIDER_OWNER_HINTS } from '../../shared/cliproxy-model-routing';
import { getCcsDir } from '../../utils/config-manager';
import { maskSensitiveValue } from '../../utils/sensitive-keys';
import type { CLIProxyProvider } from '../../cliproxy/types';

const router = Router();

/** Chinese providers that support API key configuration in the dashboard */
const CHINESE_PROVIDERS = new Set(['deepseek', 'glm', 'kimi', 'mm', 'deepseek']);

/** Resolve the API key storage path for a provider */
function resolveProviderApiKeyPath(provider: string): string {
  return path.join(getCcsDir(), `${provider}.apikey`);
}

/** Read a provider's API key from disk */
function readProviderApiKey(provider: string): string | null {
  try {
    const keyPath = resolveProviderApiKeyPath(provider);
    if (!fs.existsSync(keyPath)) return null;
    return fs.readFileSync(keyPath, 'utf-8').trim();
  } catch {
    return null;
  }
}

/** Write a provider's API key to disk */
function writeProviderApiKey(provider: string, apiKey: string): void {
  const keyPath = resolveProviderApiKeyPath(provider);
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  fs.writeFileSync(keyPath, apiKey, { mode: 0o600 });
}

/** Delete a provider's API key from disk */
function deleteProviderApiKey(provider: string): void {
  try {
    const keyPath = resolveProviderApiKeyPath(provider);
    if (fs.existsSync(keyPath)) {
      fs.unlinkSync(keyPath);
    }
  } catch {
    // ignore
  }
}

/** Check if a provider is a Chinese provider that supports API keys */
function isChineseProvider(provider: string): boolean {
  return CHINESE_PROVIDERS.has(provider.toLowerCase());
}

router.use((req: Request, res: Response, next) => {
  if (
    requireLocalAccessWhenAuthDisabled(
      req,
      res,
      'CLIProxy providers endpoints require localhost access when dashboard auth is disabled.'
    )
  ) {
    next();
  }
});

/**
 * GET /api/cliproxy/providers - Get all providers with auth status and metadata
 * Returns: { providers: Array<{ provider, displayName, authenticated, accountCount, modelCount }> }
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const target = getProxyTarget();
    let authStatus: Array<{
      provider: string;
      displayName: string;
      authenticated: boolean;
      accounts: Array<unknown>;
    }> = [];

    if (target.isRemote) {
      const remoteStatus = await fetchRemoteAuthStatus(target);
      authStatus = remoteStatus.map((status) => {
        const oauthConfig = getOAuthConfig(status.provider as CLIProxyProvider);
        return {
          provider: status.provider,
          displayName: oauthConfig.displayName || status.provider,
          authenticated: status.authenticated,
          accounts: status.accounts || [],
        };
      });
    } else {
      initializeAccounts();
      const statuses = getAllAuthStatus();
      authStatus = statuses.map((status) => {
        const oauthConfig = getOAuthConfig(status.provider);
        return {
          provider: status.provider,
          displayName: oauthConfig.displayName || status.provider,
          authenticated: status.authenticated,
          accounts: status.accounts || [],
        };
      });
    }

    // Get model counts from static catalog (primary source)
    const modelCounts: Record<string, number> = {};
    for (const status of authStatus) {
      const provider = status.provider.toLowerCase();
      const catalog = MODEL_CATALOG[status.provider as CLIProxyProvider];
      if (catalog) {
        modelCounts[provider] = catalog.models.length;
      }
    }

    const providers = authStatus.map((status) => {
      const providerLower = status.provider.toLowerCase();
      const apiKey = readProviderApiKey(status.provider);
      return {
        provider: status.provider,
        displayName: status.displayName,
        authenticated: status.authenticated,
        accountCount: status.accounts.length,
        modelCount: modelCounts[providerLower] || 0,
        secretConfigured: isChineseProvider(status.provider)
          ? Boolean(apiKey && apiKey.length > 0)
          : undefined,
      };
    });

    res.json({ providers });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/cliproxy/providers/config - Get proxy base URL config
 * Returns: { baseUrl, isRemote, source: 'local' | 'remote' }
 */
router.get('/config', async (_req: Request, res: Response): Promise<void> => {
  try {
    const target = getProxyTarget();
    const baseUrl = target.isRemote
      ? `${target.protocol}://${target.host}:${target.port}`
      : `http://127.0.0.1:${target.port}`;

    res.json({
      baseUrl,
      isRemote: target.isRemote,
      source: target.isRemote ? 'remote' : 'local',
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/cliproxy/providers/:provider/models - Get models for a specific provider
 * Returns: { provider, models: Array<{ id, name, owned_by, source }> }
 */
router.get('/:provider/models', async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider } = req.params;

    // Validate provider
    const validProviders: CLIProxyProvider[] = [...CLIPROXY_PROFILES];
    if (!validProviders.includes(provider as CLIProxyProvider)) {
      res.status(400).json({ error: `Invalid provider: ${provider}` });
      return;
    }

    // Build model list from static catalog (primary source), enriched with live data when available
    type ProviderModelEntry = {
      id: string;
      name: string;
      owned_by: string;
      source: 'live' | 'catalog';
    };
    let providerModels: ProviderModelEntry[] = [];

    // Always start with static catalog as the source of truth
    const catalog = MODEL_CATALOG[provider as CLIProxyProvider];
    if (catalog) {
      providerModels = catalog.models.map((model) => ({
        id: model.id,
        name: model.name,
        owned_by: provider,
        source: 'catalog' as const,
      }));
    }

    // Try to enrich with live models from CLIProxy
    const running = await isCliproxyRunning();
    if (running) {
      try {
        const modelsResponse = await fetchCliproxyModels();
        if (modelsResponse?.models) {
          // Build a set of live model IDs that belong to this provider
          const hints = PROVIDER_OWNER_HINTS[provider.toLowerCase()] || [provider.toLowerCase()];
          const liveModelIds = new Set(
            modelsResponse.models
              .filter((model) => {
                const ownedBy = model.owned_by?.toLowerCase() || '';
                return hints.some((hint: string) => ownedBy.includes(hint));
              })
              .map((model) => model.id)
          );

          // Mark catalog models as "live" if they appear in the live model list
          providerModels = providerModels.map((model) =>
            liveModelIds.has(model.id) ? { ...model, source: 'live' as const } : model
          );
        }
      } catch {
        // Ignore live fetch errors, catalog models remain as fallback
      }
    }

    res.json({ provider, models: providerModels });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ==================== API Key Management for Chinese Providers ====================

/**
 * GET /api/provider-models/:provider/apikey - Get API key status (masked)
 * Returns: { provider, secretConfigured, maskedKey }
 */
router.get('/:provider/apikey', async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider } = req.params;

    if (!isChineseProvider(provider)) {
      res
        .status(400)
        .json({ error: `Provider ${provider} does not support API key configuration` });
      return;
    }

    const apiKey = readProviderApiKey(provider);
    const secretConfigured = Boolean(apiKey && apiKey.length > 0);

    res.json({
      provider,
      secretConfigured,
      maskedKey: secretConfigured && apiKey ? maskSensitiveValue(apiKey) : null,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/provider-models/:provider/apikey - Save or update API key
 * Body: { apiKey: string }
 */
router.put('/:provider/apikey', async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider } = req.params;
    const { apiKey } = req.body ?? {};

    if (!isChineseProvider(provider)) {
      res
        .status(400)
        .json({ error: `Provider ${provider} does not support API key configuration` });
      return;
    }

    if (typeof apiKey !== 'string' || !apiKey.trim()) {
      res.status(400).json({ error: 'apiKey is required and must be a non-empty string' });
      return;
    }

    writeProviderApiKey(provider, apiKey.trim());

    res.json({
      provider,
      secretConfigured: true,
      maskedKey: maskSensitiveValue(apiKey.trim()),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/provider-models/:provider/apikey - Clear API key
 */
router.delete('/:provider/apikey', async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider } = req.params;

    if (!isChineseProvider(provider)) {
      res
        .status(400)
        .json({ error: `Provider ${provider} does not support API key configuration` });
      return;
    }

    deleteProviderApiKey(provider);

    res.json({
      provider,
      secretConfigured: false,
      maskedKey: null,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
