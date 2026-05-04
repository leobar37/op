import type { DroidCustomModel, DroidCustomModelEntry, DroidManagedModelRef } from './types';
import type { DroidPathsOptions } from './paths';
import {
  readDroidSettingsSync,
  writeDroidSettingsSync,
  normalizeCustomModels,
  acquireFactoryLock,
} from './io';
import { validateProfileName, isValidProfileName } from './validation';
import { applyReasoningOverride } from './reasoning';

const CCS_MODEL_PREFIX = 'ccs-';
const CCS_DISPLAY_PREFIX = 'CCS ';

function isSupportedProvider(value: string): value is DroidCustomModel['provider'] {
  return value === 'anthropic' || value === 'openai' || value === 'generic-chat-completion-api';
}

function isManagedDisplayName(displayName: string): boolean {
  return displayName.startsWith(CCS_DISPLAY_PREFIX) || displayName.startsWith(CCS_MODEL_PREFIX);
}

function parseManagedProfile(displayName: string): string | null {
  let profile: string | null = null;

  if (displayName.startsWith(CCS_DISPLAY_PREFIX)) {
    profile = displayName.slice(CCS_DISPLAY_PREFIX.length).trim();
  } else if (displayName.startsWith(CCS_MODEL_PREFIX)) {
    profile = displayName.slice(CCS_MODEL_PREFIX.length).trim();
  }

  if (!profile || !isValidProfileName(profile)) return null;
  return profile;
}

function buildSelectorAlias(displayName: string, index: number): string {
  const normalizedDisplayName = displayName.trim().replace(/\s+/g, '-');
  return `${normalizedDisplayName}-${index}`;
}

export function listModelsSync(options?: DroidPathsOptions): DroidCustomModel[] {
  const settings = readDroidSettingsSync(options);
  const result: DroidCustomModel[] = [];

  for (const entry of normalizeCustomModels(settings.customModels)) {
    const profile = parseManagedProfile(entry.displayName);
    if (!profile) continue;
    if (!isSupportedProvider(entry.provider)) continue;

    result.push({
      model: entry.model,
      displayName: entry.displayName,
      baseUrl: entry.baseUrl,
      apiKey: entry.apiKey,
      provider: entry.provider,
      maxOutputTokens: entry.maxOutputTokens,
    });
  }

  return result;
}

export async function listModels(options?: DroidPathsOptions): Promise<DroidCustomModel[]> {
  return listModelsSync(options);
}

export function listCcsModelsSync(options?: DroidPathsOptions): Map<string, DroidCustomModel> {
  const result = new Map<string, DroidCustomModel>();
  const settings = readDroidSettingsSync(options);

  for (const entry of normalizeCustomModels(settings.customModels)) {
    const profile = parseManagedProfile(entry.displayName);
    if (!profile) continue;
    if (!isSupportedProvider(entry.provider)) continue;

    result.set(profile, {
      model: entry.model,
      displayName: entry.displayName,
      baseUrl: entry.baseUrl,
      apiKey: entry.apiKey,
      provider: entry.provider,
      maxOutputTokens: entry.maxOutputTokens,
    });
  }

  return result;
}

export async function listCcsModels(
  options?: DroidPathsOptions
): Promise<Map<string, DroidCustomModel>> {
  return listCcsModelsSync(options);
}

export function getModelSync(
  profile: string,
  options?: DroidPathsOptions
): DroidCustomModel | null {
  validateProfileName(profile);
  const settings = readDroidSettingsSync(options);

  for (const entry of normalizeCustomModels(settings.customModels)) {
    if (parseManagedProfile(entry.displayName) === profile) {
      if (!isSupportedProvider(entry.provider)) return null;
      return {
        model: entry.model,
        displayName: entry.displayName,
        baseUrl: entry.baseUrl,
        apiKey: entry.apiKey,
        provider: entry.provider,
        maxOutputTokens: entry.maxOutputTokens,
      };
    }
  }

  return null;
}

export async function getModel(
  profile: string,
  options?: DroidPathsOptions
): Promise<DroidCustomModel | null> {
  return getModelSync(profile, options);
}

export async function addModel(
  profile: string,
  model: DroidCustomModel,
  options?: DroidPathsOptions
): Promise<DroidManagedModelRef> {
  validateProfileName(profile);

  let release: (() => Promise<void>) | undefined;
  let ref: DroidManagedModelRef | null = null;

  try {
    release = await acquireFactoryLock({ ...options, retries: 10 });

    const settings = readDroidSettingsSync(options);
    settings.customModels = normalizeCustomModels(settings.customModels);

    const idx = settings.customModels.findIndex(
      (m) => parseManagedProfile(m.displayName) === profile
    );

    const { reasoningOverride, ...modelWithoutReasoning } = model;
    const existingEntry = idx >= 0 ? settings.customModels[idx] : undefined;
    const entry: DroidCustomModelEntry = {
      ...(existingEntry ?? {}),
      ...modelWithoutReasoning,
      displayName: `CCS ${profile}`,
    };

    if (reasoningOverride !== undefined) {
      applyReasoningOverride(entry, model.provider, reasoningOverride);
    }

    if (idx >= 0) {
      settings.customModels[idx] = entry;
    } else {
      settings.customModels.push(entry);
    }

    const index = settings.customModels.findIndex(
      (e) => parseManagedProfile(e.displayName) === profile
    );
    const safeIndex = index >= 0 ? index : 0;
    const selectorAlias = buildSelectorAlias(entry.displayName, safeIndex);
    const selector = `custom:${selectorAlias}`;
    settings.model = selector;

    writeDroidSettingsSync(settings, options);
    ref = { profile, displayName: entry.displayName, index: safeIndex, selectorAlias, selector };
  } finally {
    if (release) await release();
  }

  return (
    ref || {
      profile,
      displayName: `CCS ${profile}`,
      index: 0,
      selectorAlias: `CCS-${profile}-0`,
      selector: `custom:CCS-${profile}-0`,
    }
  );
}

export async function updateModel(
  profile: string,
  patch: Partial<DroidCustomModel>,
  options?: DroidPathsOptions
): Promise<DroidManagedModelRef> {
  validateProfileName(profile);

  let release: (() => Promise<void>) | undefined;
  let ref: DroidManagedModelRef | null = null;

  try {
    release = await acquireFactoryLock({ ...options, retries: 10 });

    const settings = readDroidSettingsSync(options);
    settings.customModels = normalizeCustomModels(settings.customModels);

    const idx = settings.customModels.findIndex(
      (m) => parseManagedProfile(m.displayName) === profile
    );

    if (idx < 0) {
      throw new Error(`Model for profile "${profile}" not found`);
    }

    const existing = settings.customModels[idx];
    const updated: DroidCustomModelEntry = { ...existing };

    if (patch.model !== undefined) updated.model = patch.model;
    if (patch.displayName !== undefined) updated.displayName = patch.displayName;
    if (patch.baseUrl !== undefined) updated.baseUrl = patch.baseUrl;
    if (patch.apiKey !== undefined) updated.apiKey = patch.apiKey;
    if (patch.provider !== undefined) updated.provider = patch.provider;
    if (patch.maxOutputTokens !== undefined) updated.maxOutputTokens = patch.maxOutputTokens;

    const provider = isSupportedProvider(updated.provider)
      ? updated.provider
      : 'generic-chat-completion-api';

    if (patch.reasoningOverride !== undefined) {
      applyReasoningOverride(updated, provider, patch.reasoningOverride);
    }

    settings.customModels[idx] = updated;

    const index = settings.customModels.findIndex(
      (e) => parseManagedProfile(e.displayName) === profile
    );
    const safeIndex = index >= 0 ? index : 0;
    const selectorAlias = buildSelectorAlias(updated.displayName, safeIndex);
    const selector = `custom:${selectorAlias}`;

    writeDroidSettingsSync(settings, options);
    ref = { profile, displayName: updated.displayName, index: safeIndex, selectorAlias, selector };
  } finally {
    if (release) await release();
  }

  return (
    ref || {
      profile,
      displayName: `CCS ${profile}`,
      index: 0,
      selectorAlias: `CCS-${profile}-0`,
      selector: `custom:CCS-${profile}-0`,
    }
  );
}

export async function removeModel(profile: string, options?: DroidPathsOptions): Promise<void> {
  validateProfileName(profile);

  let release: (() => Promise<void>) | undefined;

  try {
    release = await acquireFactoryLock({ ...options, retries: 3 });

    const settings = readDroidSettingsSync(options);
    settings.customModels = normalizeCustomModels(settings.customModels);

    settings.customModels = settings.customModels.filter(
      (m) => parseManagedProfile(m.displayName) !== profile
    );

    writeDroidSettingsSync(settings, options);
  } finally {
    if (release) await release();
  }
}

export async function removeModelByIndex(
  index: number,
  options?: DroidPathsOptions
): Promise<void> {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Invalid model index: ${index}`);
  }

  let release: (() => Promise<void>) | undefined;

  try {
    release = await acquireFactoryLock({ ...options, retries: 3 });

    const settings = readDroidSettingsSync(options);
    settings.customModels = normalizeCustomModels(settings.customModels);

    if (index >= settings.customModels.length) {
      throw new Error(
        `Model index ${index} out of bounds (total: ${settings.customModels.length})`
      );
    }

    settings.customModels.splice(index, 1);

    writeDroidSettingsSync(settings, options);
  } finally {
    if (release) await release();
  }
}

export async function setActiveModel(selector: string, options?: DroidPathsOptions): Promise<void> {
  let release: (() => Promise<void>) | undefined;

  try {
    release = await acquireFactoryLock({ ...options, retries: 3 });

    const settings = readDroidSettingsSync(options);
    settings.model = selector;

    writeDroidSettingsSync(settings, options);
  } finally {
    if (release) await release();
  }
}

export async function pruneOrphanedModels(
  activeProfiles: string[],
  options?: DroidPathsOptions
): Promise<number> {
  const activeProfilesSnapshot = [...activeProfiles];

  let release: (() => Promise<void>) | undefined;
  let removed = 0;

  try {
    release = await acquireFactoryLock({ ...options, retries: 3 });

    const activeProfileSet = new Set<string>();
    for (const profile of activeProfilesSnapshot) {
      validateProfileName(profile);
      activeProfileSet.add(profile);
    }

    const settings = readDroidSettingsSync(options);
    settings.customModels = normalizeCustomModels(settings.customModels);

    const before = settings.customModels.length;
    settings.customModels = settings.customModels.filter((m) => {
      const profile = parseManagedProfile(m.displayName);
      if (profile) {
        return activeProfileSet.has(profile);
      }
      return !isManagedDisplayName(m.displayName);
    });

    removed = before - settings.customModels.length;
    if (removed > 0) {
      writeDroidSettingsSync(settings, options);
    }
  } finally {
    if (release) await release();
  }

  return removed;
}
