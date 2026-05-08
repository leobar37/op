/**
 * Pi auth.json types and schemas.
 *
 * Pi stores credentials in ~/.pi/agent/auth.json as an object keyed by
 * provider name. Each entry is either an api_key entry or an oauth entry.
 */

export type PiAuthType = 'api_key' | 'oauth';

export interface PiApiKeyEntry {
  type: 'api_key';
  key: string;
}

export interface PiOAuthEntry {
  type: 'oauth';
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

export type PiAuthEntry = PiApiKeyEntry | PiOAuthEntry;

export interface PiAuthStore {
  [provider: string]: PiAuthEntry;
}

/** Redacted view of a single auth entry for diagnostics / UI. */
export interface PiRedactedAuthEntry {
  type: PiAuthType;
  key?: string;
}

/** Redacted view of the entire auth store. */
export type PiRedactedAuthStore = Record<string, PiRedactedAuthEntry>;

/** Options passed to read/write operations. */
export interface PiAuthStoreOptions {
  /** Override home directory (for tests). */
  homeDir?: string;
  /** Override process env (for tests). */
  env?: NodeJS.ProcessEnv;
}

/** Result of reading raw auth.json contents. */
export interface PiReadRawResult {
  text: string;
  mtime: number;
}

/** Result of writing raw auth.json contents. */
export interface PiWriteRawResult {
  mtime: number;
}
