import type { Request, Response } from 'express';
import { Router } from 'express';
import { ZodError } from 'zod';
import http from 'http';
import {
  DroidSettingsStore,
  validateCustomModel,
  computeModelHash,
  removeModelByIndex,
} from '../../droid-settings';
import {
  DroidRawSettingsConflictError,
  DroidRawSettingsValidationError,
  getDroidDashboardDiagnostics,
  getDroidRawSettings,
  saveDroidRawSettings,
} from '../services/droid-dashboard-service';

const router = Router();

// --- Proxy Status Helper ---

const PROXY_PING_TIMEOUT_MS = 5000;
const CLIPROXY_DEFAULT_PORT = 8317;

interface ProxyPingResult {
  status: 'connected' | 'disconnected' | 'not-proxy';
  port?: number;
}

function isLocalhost(host: string): boolean {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

function isCliproxyPort(port: number): boolean {
  return port >= CLIPROXY_DEFAULT_PORT;
}

function pingProxy(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/v1/models',
        method: 'GET',
        timeout: PROXY_PING_TIMEOUT_MS,
      },
      (res) => {
        resolve(res.statusCode === 200);
      }
    );

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

async function checkModelProxyStatus(baseUrl: string | null | undefined): Promise<ProxyPingResult> {
  if (!baseUrl) {
    return { status: 'not-proxy' };
  }

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return { status: 'not-proxy' };
  }

  const port = parsed.port
    ? Number.parseInt(parsed.port, 10)
    : parsed.protocol === 'https:'
      ? 443
      : 80;

  if (!isLocalhost(parsed.hostname) || !isCliproxyPort(port)) {
    return { status: 'not-proxy' };
  }

  const isConnected = await pingProxy(port);
  return {
    status: isConnected ? 'connected' : 'disconnected',
    port,
  };
}

function formatZodError(error: ZodError): Array<{ path: (string | number)[]; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.map((p) => (typeof p === 'symbol' ? String(p) : p)),
    message: issue.message,
  }));
}

/**
 * GET /api/droid/diagnostics
 * Dashboard-ready Droid installation + BYOK configuration diagnostics.
 */
router.get('/diagnostics', async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json(await getDroidDashboardDiagnostics());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/droid/settings/raw
 * Raw ~/.factory/settings.json payload for editor.
 */
router.get('/settings/raw', async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json(await getDroidRawSettings());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/droid/settings/raw
 * Save raw ~/.factory/settings.json payload from dashboard editor.
 */
router.put('/settings/raw', async (req: Request, res: Response): Promise<void> => {
  try {
    const { rawText, expectedMtime } = req.body ?? {};

    if (typeof rawText !== 'string') {
      res.status(400).json({ error: 'rawText must be a string.' });
      return;
    }
    if (
      expectedMtime !== undefined &&
      (typeof expectedMtime !== 'number' || !Number.isFinite(expectedMtime))
    ) {
      res.status(400).json({ error: 'expectedMtime must be a finite number when provided.' });
      return;
    }

    res.json(await saveDroidRawSettings({ rawText, expectedMtime }));
  } catch (error) {
    if (error instanceof DroidRawSettingsValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof DroidRawSettingsConflictError) {
      res.status(409).json({ error: error.message, mtime: error.mtime });
      return;
    }
    res.status(500).json({ error: (error as Error).message });
  }
});

// --- CustomModels CRUD ---

const store = new DroidSettingsStore();

function buildResponse(settings: Record<string, unknown>, meta?: Record<string, unknown>) {
  return {
    success: true,
    data: settings,
    meta: meta ?? {},
  };
}

/**
 * GET /api/droid/models
 * List all customModels with full settings.
 */
router.get('/models', async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await store.read();
    const models = await store.listModels();
    res.json(
      buildResponse(settings as Record<string, unknown>, {
        customModelCount: models.length,
        activeModel: settings.model,
      })
    );
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/droid/models/:profile
 * Get a single customModel by profile with full settings.
 */
router.get('/models/:profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const model = await store.getModel(req.params.profile);
    if (!model) {
      res
        .status(404)
        .json({ success: false, error: `Model for profile "${req.params.profile}" not found` });
      return;
    }
    const settings = await store.read();
    res.json(
      buildResponse(settings as Record<string, unknown>, {
        model,
        activeModel: settings.model,
      })
    );
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/droid/models
 * Create a new customModel. Body validated with Zod.
 */
router.post('/models', async (req: Request, res: Response): Promise<void> => {
  try {
    const { profile, ...modelData } = req.body ?? {};
    if (typeof profile !== 'string' || !profile.trim()) {
      res.status(400).json({ success: false, error: 'profile is required' });
      return;
    }

    const ref = await store.addModel(profile, modelData);
    const settings = await store.read();
    res.status(201).json(
      buildResponse(settings as Record<string, unknown>, {
        ref,
        activeModel: settings.model,
      })
    );
  } catch (error) {
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({ success: false, error: 'Validation failed', details: formatZodError(error) });
      return;
    }
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * PUT /api/droid/models/:profile
 * Update an existing customModel. Body validated with Zod partial.
 */
router.put('/models/:profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const ref = await store.updateModel(req.params.profile, req.body ?? {});
    const settings = await store.read();
    res.json(
      buildResponse(settings as Record<string, unknown>, {
        ref,
        activeModel: settings.model,
      })
    );
  } catch (error) {
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({ success: false, error: 'Validation failed', details: formatZodError(error) });
      return;
    }
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * DELETE /api/droid/models/:profile
 * Remove a customModel by profile name or numeric index.
 * If :profile is a non-negative integer string, it is treated as an array index.
 */
router.delete('/models/:profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const param = req.params.profile;
    const index = Number.parseInt(param, 10);
    const isIndex = !Number.isNaN(index) && String(index) === param && index >= 0;

    if (isIndex) {
      await removeModelByIndex(index);
    } else {
      await store.removeModel(param);
    }

    const settings = await store.read();
    res.json(
      buildResponse(settings as Record<string, unknown>, {
        activeModel: settings.model,
      })
    );
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * PATCH /api/droid/models/:profile/active
 * Set a customModel as the active model.
 */
router.patch('/models/:profile/active', async (req: Request, res: Response): Promise<void> => {
  try {
    const model = await store.getModel(req.params.profile);
    if (!model) {
      res
        .status(404)
        .json({ success: false, error: `Model for profile "${req.params.profile}" not found` });
      return;
    }

    const selector = `custom:${model.displayName.replace(/\s+/g, '-')}-${model.displayName}`;
    await store.setActiveModel(selector);
    const settings = await store.read();
    res.json(
      buildResponse(settings as Record<string, unknown>, {
        activeModel: settings.model,
      })
    );
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/droid/models/apply
 * Apply a generated DroidCustomModelEntry to settings.json.
 * Body: { entry: DroidCustomModelEntry, hash?: string }
 * The entry is validated with Zod, then upserted into customModels.
 */
router.post('/models/apply', async (req: Request, res: Response): Promise<void> => {
  try {
    const { entry, hash } = req.body ?? {};

    if (!entry || typeof entry !== 'object') {
      res.status(400).json({ success: false, error: 'entry is required' });
      return;
    }

    // Validate entry with Zod
    const validated = validateCustomModel(entry);

    // Derive profile from displayName (strip CCS prefix if present)
    const profile = validated.displayName.replace(/^CCS\s+/i, '').replace(/^ccs-/, '');

    // Compute hash if not provided
    const computedHash = hash || computeModelHash(entry);

    // Upsert the model
    const ref = await store.addModel(profile, validated);
    const settings = await store.read();

    res.status(201).json(
      buildResponse(settings as Record<string, unknown>, {
        ref,
        appliedHash: computedHash,
        activeModel: settings.model,
      })
    );
  } catch (error) {
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({ success: false, error: 'Validation failed', details: formatZodError(error) });
      return;
    }
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/droid/models/:profile/proxy-status
 * Check if a model's baseUrl points to a running CLIProxy.
 */
router.get('/models/:profile/proxy-status', async (req: Request, res: Response): Promise<void> => {
  try {
    const model = await store.getModel(req.params.profile);
    if (!model) {
      res
        .status(404)
        .json({ success: false, error: `Model for profile "${req.params.profile}" not found` });
      return;
    }

    const result = await checkModelProxyStatus(model.baseUrl);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
