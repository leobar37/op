/**
 * CLIProxy Providers Routes - Global provider view with model catalog
 * Returns provider cards data and model lists for Droid/CLI integration
 */

import { Router, Request, Response } from 'express';
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
import type { CLIProxyProvider } from '../../cliproxy/types';

const router = Router();

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

    const providers = authStatus.map((status) => ({
      provider: status.provider,
      displayName: status.displayName,
      authenticated: status.authenticated,
      accountCount: status.accounts.length,
      modelCount: modelCounts[status.provider.toLowerCase()] || 0,
    }));

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

export default router;
