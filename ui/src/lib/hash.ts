/**
 * Deterministic hash computation for Droid custom model entries.
 * Must match the server-side computeModelHash in src/droid-settings/validation.ts.
 *
 * Uses Web Crypto API (crypto.subtle.digest) for SHA-256 in the browser.
 */

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

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute a deterministic hash for a Droid custom model entry.
 * Matches the server-side computeModelHash exactly.
 */
export async function computeModelHash(entry: Record<string, unknown>): Promise<string> {
  const normalized = normalizeForHash(entry);
  const json = JSON.stringify(normalized);
  const hash = await sha256(json);
  return hash.slice(0, 12);
}

/**
 * Synchronous fallback that uses the same normalization but a simple
 * string hash. Only used for initial render before async hash resolves.
 * NOTE: This will NOT match the server hash. Always prefer computeModelHash.
 */
export function computeClientHashFallback(entry: Record<string, unknown>): string {
  const normalized = normalizeForHash(entry);
  let hash = 0;
  const str = JSON.stringify(normalized);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
