import { createHash } from 'crypto';
import { DroidCustomModelSchema, type DroidCustomModel } from './types';

export function isValidProfileName(profile: string): boolean {
  return !!profile && /^[a-zA-Z0-9._-]+$/.test(profile);
}

export function validateProfileName(profile: string): void {
  if (!isValidProfileName(profile)) {
    throw new Error(
      `Invalid profile name "${profile}": must contain only alphanumeric characters, dots, underscores, or hyphens`
    );
  }
}

export function validateCustomModel(model: unknown): DroidCustomModel {
  return DroidCustomModelSchema.parse(model);
}

export function validateCustomModelPartial(model: unknown): Partial<DroidCustomModel> {
  return DroidCustomModelSchema.partial().parse(model);
}

/**
 * Compute a deterministic hash for a Droid custom model entry.
 * Used to track whether a generated model has already been applied to Droid.
 */
export function computeModelHash(entry: Record<string, unknown>): string {
  // Normalize: sort keys recursively for deterministic serialization
  const normalized = normalizeForHash(entry);
  const json = JSON.stringify(normalized);
  return createHash('sha256').update(json).digest('hex').slice(0, 12);
}

function normalizeForHash(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(normalizeForHash);
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[key] = normalizeForHash((value as Record<string, unknown>)[key]);
  }
  return sorted;
}
