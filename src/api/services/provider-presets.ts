/**
 * Provider Presets for CLI
 *
 * Pre-configured templates for common API providers.
 * Uses shared source-of-truth catalog in src/shared/provider-preset-catalog.ts.
 */

import {
  PROVIDER_PRESET_ALIASES,
  createProviderPresetDefinitions,
  normalizeProviderPresetId,
  type PresetCategory,
  type ProviderPresetDefinition,
} from '../../shared/provider-preset-catalog';

export type { PresetCategory };
export type ProviderPreset = ProviderPresetDefinition;

/**
 * Provider presets available via CLI and UI
 */
export const PROVIDER_PRESETS: readonly ProviderPreset[] = Object.freeze(
  createProviderPresetDefinitions()
);
export const PRESET_ALIASES: Readonly<Record<string, string>> = PROVIDER_PRESET_ALIASES;

/** Get preset by ID */
export function getPresetById(id: string): ProviderPreset | undefined {
  const canonical = normalizeProviderPresetId(id);
  return PROVIDER_PRESETS.find((p) => p.id === canonical);
}

/** Get all preset IDs */
export function getPresetIds(): string[] {
  return PROVIDER_PRESETS.map((p) => p.id);
}

/** Get alias map (alias -> canonical preset ID). */
export function getPresetAliases(): Readonly<Record<string, string>> {
  return PRESET_ALIASES;
}

/** Check if preset ID is valid */
export function isValidPresetId(id: string): boolean {
  return getPresetById(id) !== undefined;
}
