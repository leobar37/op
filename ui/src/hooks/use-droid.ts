import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiConflictError, withApiBase } from '@/lib/api-client';
import type {
  CompatibleCliDocLink,
  CompatibleCliProviderDocLink,
} from '@shared/compatible-cli-contracts';

export interface DroidBinaryDiagnostics {
  installed: boolean;
  path: string | null;
  installDir: string | null;
  source: 'CCS_DROID_PATH' | 'PATH' | 'missing';
  version: string | null;
  overridePath: string | null;
}

export interface DroidConfigFileDiagnostics {
  label: string;
  path: string;
  resolvedPath: string;
  exists: boolean;
  isSymlink: boolean;
  isRegularFile: boolean;
  sizeBytes: number | null;
  mtimeMs: number | null;
  parseError: string | null;
  readError: string | null;
}

export interface DroidCustomModelDiagnostics {
  index: number;
  displayName: string;
  model: string;
  provider: string;
  baseUrl: string;
  host: string | null;
  maxOutputTokens: number | null;
  isCcsManaged: boolean;
  apiKeyState: 'set' | 'missing';
  apiKeyPreview: string | null;
}

export interface DroidDashboardDiagnostics {
  binary: DroidBinaryDiagnostics;
  files: {
    settings: DroidConfigFileDiagnostics;
    legacyConfig: DroidConfigFileDiagnostics;
  };
  byok: {
    activeModelSelector: string | null;
    customModelCount: number;
    ccsManagedCount: number;
    userManagedCount: number;
    invalidModelEntryCount: number;
    providerBreakdown: Record<string, number>;
    customModels: DroidCustomModelDiagnostics[];
  };
  warnings: string[];
  docsReference: {
    providerValues: string[];
    settingsHierarchy: string[];
    notes: string[];
    links: CompatibleCliDocLink[];
    providerDocs: CompatibleCliProviderDocLink[];
  };
}

export interface DroidRawSettings {
  path: string;
  resolvedPath: string;
  exists: boolean;
  mtime: number;
  rawText: string;
  settings: Record<string, unknown> | null;
  parseError: string | null;
}

interface SaveDroidRawSettingsInput {
  rawText: string;
  expectedMtime?: number;
}

interface SaveDroidRawSettingsResponse {
  success: true;
  mtime: number;
}

interface UpdateDroidModelRawInput {
  index: number;
  modelRawText: string;
  expectedMtime?: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function findModelEntryByIndex(
  settings: Record<string, unknown>,
  index: number
): { container: unknown[]; key: number; entry: Record<string, unknown> } | null {
  for (const rootKey of ['customModels', 'custom_models'] as const) {
    const container = settings[rootKey];
    if (Array.isArray(container) && index >= 0 && index < container.length) {
      const item = container[index];
      if (isObject(item)) {
        return { container, key: index, entry: item };
      }
    }
  }
  return null;
}

function replaceModelEntryByIndex(
  settings: Record<string, unknown>,
  index: number,
  newEntry: Record<string, unknown>
): Record<string, unknown> | null {
  const nextSettings = JSON.parse(JSON.stringify(settings)) as Record<string, unknown>;
  const found = findModelEntryByIndex(nextSettings, index);
  if (!found) return null;

  found.container[found.key] = newEntry;
  return nextSettings;
}

function parseDroidRawSettingsText(rawText: string): {
  settings: Record<string, unknown> | null;
  parseError: string | null;
} {
  try {
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        settings: null,
        parseError: 'JSON root must be an object.',
      };
    }
    return {
      settings: parsed as Record<string, unknown>,
      parseError: null,
    };
  } catch (error) {
    return {
      settings: null,
      parseError: (error as Error).message,
    };
  }
}

async function fetchDroidDiagnostics(): Promise<DroidDashboardDiagnostics> {
  const res = await fetch(withApiBase('/droid/diagnostics'));
  if (!res.ok) throw new Error('Failed to fetch Droid diagnostics');
  return res.json();
}

async function fetchDroidRawSettings(): Promise<DroidRawSettings> {
  const res = await fetch(withApiBase('/droid/settings/raw'));
  if (!res.ok) throw new Error('Failed to fetch Droid raw settings');
  return res.json();
}

async function saveDroidRawSettings(
  data: SaveDroidRawSettingsInput
): Promise<SaveDroidRawSettingsResponse> {
  const res = await fetch(withApiBase('/droid/settings/raw'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (res.status === 409) throw new ApiConflictError('Droid raw settings changed externally');

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || 'Failed to save Droid raw settings');
  }
  return res.json();
}

async function updateDroidModelRaw(
  data: UpdateDroidModelRawInput
): Promise<SaveDroidRawSettingsResponse> {
  // Fetch current raw settings
  const current = await fetchDroidRawSettings();
  if (!current.settings) {
    throw new Error('Failed to load current settings');
  }

  let parsedEntry: Record<string, unknown>;
  try {
    parsedEntry = JSON.parse(data.modelRawText) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid JSON in model editor');
  }

  if (!isObject(parsedEntry)) {
    throw new Error('Model JSON must be an object');
  }

  const nextSettings = replaceModelEntryByIndex(current.settings, data.index, parsedEntry);
  if (!nextSettings) {
    throw new Error(`Model at index ${data.index} not found in settings`);
  }

  const rawText = JSON.stringify(nextSettings, null, 2);
  return saveDroidRawSettings({
    rawText,
    expectedMtime: data.expectedMtime ?? current.mtime,
  });
}

interface ApplyDroidModelInput {
  entry: Record<string, unknown>;
  hash?: string;
}

interface ApplyDroidModelResponse {
  success: true;
  data: Record<string, unknown>;
  meta: {
    ref: {
      profile: string;
      displayName: string;
      index: number;
      selectorAlias: string;
      selector: string;
    };
    appliedHash: string;
    activeModel?: string;
  };
}

async function applyDroidModel(data: ApplyDroidModelInput): Promise<ApplyDroidModelResponse> {
  const res = await fetch(withApiBase('/droid/models/apply'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || 'Failed to apply Droid model');
  }
  return res.json();
}

// --- Proxy Status Hook ---

export interface DroidModelProxyStatus {
  status: 'connected' | 'disconnected' | 'not-proxy';
  port?: number;
}

async function fetchDroidModelProxyStatus(profile: string): Promise<DroidModelProxyStatus> {
  const res = await fetch(withApiBase(`/droid/models/${encodeURIComponent(profile)}/proxy-status`));
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || 'Failed to fetch proxy status');
  }
  const data = (await res.json()) as {
    success: boolean;
    status: 'connected' | 'disconnected' | 'not-proxy';
    port?: number;
  };
  return { status: data.status, port: data.port };
}

function isLocalProxyUrl(baseUrl: string | null | undefined): boolean {
  if (!baseUrl) return false;
  try {
    const parsed = new URL(baseUrl);
    const isLocal =
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === 'localhost' ||
      parsed.hostname === '::1';
    const port = parsed.port
      ? Number.parseInt(parsed.port, 10)
      : parsed.protocol === 'https:'
        ? 443
        : 80;
    return isLocal && port >= 8317;
  } catch {
    return false;
  }
}

export function useDroidModelProxyStatus(profile: string, baseUrl: string | null | undefined) {
  const enabled = isLocalProxyUrl(baseUrl);

  return useQuery({
    queryKey: ['droid-model-proxy-status', profile],
    queryFn: () => fetchDroidModelProxyStatus(profile),
    enabled,
    refetchInterval: 10000,
    retry: 1,
    staleTime: 5000,
  });
}

export function useDroid() {
  const queryClient = useQueryClient();

  const diagnosticsQuery = useQuery({
    queryKey: ['droid-diagnostics'],
    queryFn: fetchDroidDiagnostics,
    refetchInterval: 10000,
  });

  const rawSettingsQuery = useQuery({
    queryKey: ['droid-raw-settings'],
    queryFn: fetchDroidRawSettings,
  });

  const saveRawSettingsMutation = useMutation({
    mutationFn: saveDroidRawSettings,
    onSuccess: (result, variables) => {
      queryClient.setQueryData<DroidRawSettings>(['droid-raw-settings'], (current) => {
        const path = current?.path ?? '~/.factory/settings.json';
        const resolvedPath = current?.resolvedPath ?? path;
        const parsed = parseDroidRawSettingsText(variables.rawText);

        return {
          path,
          resolvedPath,
          exists: true,
          mtime: result.mtime,
          rawText: variables.rawText,
          settings: parsed.settings,
          parseError: parsed.parseError,
        };
      });
      queryClient.invalidateQueries({ queryKey: ['droid-diagnostics'] });
    },
  });

  const applyModelMutation = useMutation({
    mutationFn: applyDroidModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['droid-diagnostics'] });
      queryClient.invalidateQueries({ queryKey: ['droid-raw-settings'] });
    },
  });

  const updateModelRawMutation = useMutation({
    mutationFn: updateDroidModelRaw,
    onSuccess: (result) => {
      queryClient.setQueryData<DroidRawSettings>(['droid-raw-settings'], (current) => {
        if (!current) return current;
        return {
          ...current,
          mtime: result.mtime,
        };
      });
      queryClient.invalidateQueries({ queryKey: ['droid-diagnostics'] });
      queryClient.invalidateQueries({ queryKey: ['droid-raw-settings'] });
    },
  });

  const removeModelMutation = useMutation({
    mutationFn: async (index: number) => {
      const res = await fetch(withApiBase(`/droid/models/${index}`), {
        method: 'DELETE',
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || 'Failed to remove Droid model');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['droid-diagnostics'] });
      queryClient.invalidateQueries({ queryKey: ['droid-raw-settings'] });
    },
  });

  return useMemo(
    () => ({
      diagnostics: diagnosticsQuery.data,
      diagnosticsLoading: diagnosticsQuery.isLoading,
      diagnosticsError: diagnosticsQuery.error,
      refetchDiagnostics: diagnosticsQuery.refetch,

      rawSettings: rawSettingsQuery.data,
      rawSettingsLoading: rawSettingsQuery.isLoading,
      rawSettingsError: rawSettingsQuery.error,
      refetchRawSettings: rawSettingsQuery.refetch,

      saveRawSettings: saveRawSettingsMutation.mutate,
      saveRawSettingsAsync: saveRawSettingsMutation.mutateAsync,
      isSavingRawSettings: saveRawSettingsMutation.isPending,

      applyModel: applyModelMutation.mutate,
      applyModelAsync: applyModelMutation.mutateAsync,
      isApplyingModel: applyModelMutation.isPending,

      removeModel: removeModelMutation.mutate,
      removeModelAsync: removeModelMutation.mutateAsync,
      isRemovingModel: removeModelMutation.isPending,

      updateModelRaw: updateModelRawMutation.mutate,
      updateModelRawAsync: updateModelRawMutation.mutateAsync,
      isUpdatingModelRaw: updateModelRawMutation.isPending,
    }),
    [
      diagnosticsQuery.data,
      diagnosticsQuery.isLoading,
      diagnosticsQuery.error,
      diagnosticsQuery.refetch,
      rawSettingsQuery.data,
      rawSettingsQuery.isLoading,
      rawSettingsQuery.error,
      rawSettingsQuery.refetch,
      saveRawSettingsMutation.mutate,
      saveRawSettingsMutation.mutateAsync,
      saveRawSettingsMutation.isPending,
      applyModelMutation.mutate,
      applyModelMutation.mutateAsync,
      applyModelMutation.isPending,
      removeModelMutation.mutate,
      removeModelMutation.mutateAsync,
      removeModelMutation.isPending,
      updateModelRawMutation.mutate,
      updateModelRawMutation.mutateAsync,
      updateModelRawMutation.isPending,
    ]
  );
}
