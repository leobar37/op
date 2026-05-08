/**
 * Pi auth.json read/write with atomic writes, permission hardening,
 * symlink resistance, and redaction-safe diagnostics.
 *
 * Follows the droid-settings/io.ts pattern adapted for Pi's auth.json shape.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  PiAuthStore,
  PiAuthEntry,
  PiRedactedAuthEntry,
  PiRedactedAuthStore,
  PiAuthStoreOptions,
  PiReadRawResult,
  PiWriteRawResult,
} from './types';
import { getPiAuthPath, getPiAgentDir } from './paths';
import type { PiPathsOptions } from './paths';

function getNoFollowFlag(): number {
  const candidate = (fs.constants as Record<string, number>)['O_NOFOLLOW'];
  if (process.platform !== 'win32' && typeof candidate === 'number') {
    return candidate;
  }
  return 0;
}

function openFileNoFollow(filePath: string, flags: number, mode?: number): number {
  const safeFlags = flags | getNoFollowFlag();
  if (mode === undefined) {
    return fs.openSync(filePath, safeFlags);
  }
  return fs.openSync(filePath, safeFlags, mode);
}

function readFileUtf8NoFollow(filePath: string): string {
  const fd = openFileNoFollow(filePath, fs.constants.O_RDONLY);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) {
      throw new Error('Refusing to read: auth.json is not a regular file');
    }
    return fs.readFileSync(fd, 'utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidAuthEntry(value: unknown): value is PiAuthEntry {
  if (!isObject(value)) return false;
  const record = value as Record<string, unknown>;

  if (record.type === 'api_key') {
    return typeof record.key === 'string';
  }

  if (record.type === 'oauth') {
    return typeof record.access_token === 'string';
  }

  return false;
}

function normalizeAuthStore(value: unknown): PiAuthStore {
  if (!isObject(value)) {
    return {};
  }

  const result: PiAuthStore = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isValidAuthEntry(entry)) {
      result[key] = entry;
    }
  }
  return result;
}

function ensureAgentDir(options?: PiPathsOptions): void {
  const dir = getPiAgentDir(options);
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code !== 'EEXIST') throw error;
  }
}

function fsyncDir(dirPath: string): void {
  try {
    const dirFd = fs.openSync(dirPath, fs.constants.O_RDONLY);
    try {
      fs.fsyncSync(dirFd);
    } finally {
      fs.closeSync(dirFd);
    }
  } catch {
    // Best-effort directory fsync (platform dependent).
  }
}

/**
 * Read Pi auth.json synchronously.
 *
 * @returns Parsed auth store, or empty object if file does not exist.
 * @throws Error if file is a symlink, not a regular file, or corrupted.
 */
export function readPiAuthSync(options?: PiAuthStoreOptions): PiAuthStore {
  const authPath = getPiAuthPath(options);
  if (!fs.existsSync(authPath)) {
    return {};
  }

  const fileStat = fs.lstatSync(authPath);
  if (fileStat.isSymbolicLink()) {
    throw new Error('Refusing to read: auth.json is a symlink');
  }
  if (!fileStat.isFile()) {
    throw new Error('Refusing to read: auth.json is not a regular file');
  }

  const raw = readFileUtf8NoFollow(authPath);
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeAuthStore(parsed);
  } catch {
    const backup = authPath + '.bak';
    try {
      fs.copyFileSync(authPath, backup);
      fs.chmodSync(backup, 0o600);
      console.warn(`[!] Corrupted ${authPath}, backed up to ${backup}`);
    } catch (error) {
      console.warn(`[!] Corrupted ${authPath}; backup failed: ${(error as Error).message}`);
    }
    return {};
  }
}

/**
 * Read Pi auth.json asynchronously.
 *
 * @returns Parsed auth store, or empty object if file does not exist.
 */
export async function readPiAuth(options?: PiAuthStoreOptions): Promise<PiAuthStore> {
  return readPiAuthSync(options);
}

/**
 * Write Pi auth.json synchronously with atomic replace and restrictive permissions.
 *
 * Preserves existing entries that are not explicitly overwritten.
 *
 * @param store - Complete auth store to write.
 * @throws Error if file is a symlink or temp file is a symlink.
 */
export function writePiAuthSync(store: PiAuthStore, options?: PiAuthStoreOptions): void {
  ensureAgentDir(options);
  const authPath = getPiAuthPath(options);

  if (fs.existsSync(authPath)) {
    const stat = fs.lstatSync(authPath);
    if (stat.isSymbolicLink()) {
      throw new Error('Refusing to write: auth.json is a symlink');
    }
  }

  const tmpPath = authPath + '.tmp';
  if (fs.existsSync(tmpPath)) {
    const tmpStat = fs.lstatSync(tmpPath);
    if (tmpStat.isSymbolicLink()) {
      throw new Error('Refusing to write: auth.json.tmp is a symlink');
    }
  }

  const payload = JSON.stringify(normalizeAuthStore(store), null, 2);
  const fd = openFileNoFollow(
    tmpPath,
    fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC,
    0o600
  );
  try {
    const tmpFdStat = fs.fstatSync(fd);
    if (!tmpFdStat.isFile()) {
      throw new Error('Refusing to write: auth.json.tmp is not a regular file');
    }
    fs.writeFileSync(fd, payload + '\n', { encoding: 'utf8' });
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmpPath, authPath);
  fsyncDir(path.dirname(authPath));

  try {
    const stat = fs.statSync(authPath);
    if (stat.mode & 0o077) {
      fs.chmodSync(authPath, 0o600);
      console.warn('[!] Fixed permissions on ~/.pi/agent/auth.json (was world-readable)');
    }
  } catch {
    // Best-effort permission check
  }
}

/**
 * Write Pi auth.json asynchronously.
 */
export async function writePiAuth(store: PiAuthStore, options?: PiAuthStoreOptions): Promise<void> {
  writePiAuthSync(store, options);
}

/**
 * Merge new entries into the existing auth store and write atomically.
 *
 * Existing entries for providers NOT in `entries` are preserved.
 *
 * @param entries - Partial auth store to merge.
 * @returns The merged auth store.
 */
export function mergePiAuthSync(entries: PiAuthStore, options?: PiAuthStoreOptions): PiAuthStore {
  const existing = readPiAuthSync(options);
  const merged = { ...existing, ...entries };
  writePiAuthSync(merged, options);
  return merged;
}

/**
 * Merge new entries into the existing auth store and write atomically (async).
 */
export async function mergePiAuth(
  entries: PiAuthStore,
  options?: PiAuthStoreOptions
): Promise<PiAuthStore> {
  return mergePiAuthSync(entries, options);
}

/**
 * Remove entries for the given provider keys.
 *
 * @param providerKeys - Provider keys to remove.
 * @returns The updated auth store.
 */
export function removePiAuthProvidersSync(
  providerKeys: string[],
  options?: PiAuthStoreOptions
): PiAuthStore {
  const existing = readPiAuthSync(options);
  const updated: PiAuthStore = {};
  for (const [key, entry] of Object.entries(existing)) {
    if (!providerKeys.includes(key)) {
      updated[key] = entry;
    }
  }
  writePiAuthSync(updated, options);
  return updated;
}

/**
 * Remove entries for the given provider keys (async).
 */
export async function removePiAuthProviders(
  providerKeys: string[],
  options?: PiAuthStoreOptions
): Promise<PiAuthStore> {
  return removePiAuthProvidersSync(providerKeys, options);
}

/**
 * Redact secrets from an auth entry for safe diagnostic output.
 */
export function redactAuthEntry(entry: PiAuthEntry): PiRedactedAuthEntry {
  if (entry.type === 'api_key') {
    const key = entry.key;
    const redacted = key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : '****';
    return { type: 'api_key', key: redacted };
  }

  // OAuth entry — redact all tokens
  return { type: 'oauth' };
}

/**
 * Redact secrets from the entire auth store for safe diagnostic output.
 */
export function redactAuthStore(store: PiAuthStore): PiRedactedAuthStore {
  const result: PiRedactedAuthStore = {};
  for (const [key, entry] of Object.entries(store)) {
    result[key] = redactAuthEntry(entry);
  }
  return result;
}

/**
 * Read raw auth.json text and mtime.
 */
export function readRawSync(options?: PiAuthStoreOptions): PiReadRawResult {
  const authPath = getPiAuthPath(options);
  if (!fs.existsSync(authPath)) {
    return { text: '{}', mtime: Date.now() };
  }

  const stat = fs.lstatSync(authPath);
  if (stat.isSymbolicLink()) {
    throw new Error('Refusing to read: auth.json is a symlink');
  }
  if (!stat.isFile()) {
    throw new Error('Refusing to read: auth.json is not a regular file');
  }

  const text = readFileUtf8NoFollow(authPath);
  return { text, mtime: stat.mtimeMs };
}

/**
 * Read raw auth.json text and mtime (async).
 */
export async function readRaw(options?: PiAuthStoreOptions): Promise<PiReadRawResult> {
  return readRawSync(options);
}

/**
 * Write raw auth.json text with mtime check.
 *
 * @param text - Raw JSON text.
 * @param expectedMtime - Expected mtime for optimistic concurrency.
 * @throws Error if JSON is invalid, file modified externally, or symlink detected.
 */
export function writeRawSync(
  text: string,
  expectedMtime: number | undefined,
  options?: PiAuthStoreOptions
): PiWriteRawResult {
  ensureAgentDir(options);
  const authPath = getPiAuthPath(options);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON: ${(error as Error).message}`);
  }

  if (!isObject(parsed)) {
    throw new Error('JSON root must be an object');
  }

  if (fs.existsSync(authPath) && expectedMtime !== undefined) {
    const stat = fs.lstatSync(authPath);
    if (stat.isSymbolicLink()) {
      throw new Error('Refusing to write: auth.json is a symlink');
    }
    if (Math.abs(stat.mtimeMs - expectedMtime) > 1000) {
      throw new Error('File modified externally');
    }
  }

  const tmpPath = authPath + '.tmp';
  const fd = openFileNoFollow(
    tmpPath,
    fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC,
    0o600
  );
  try {
    fs.writeFileSync(fd, text, { encoding: 'utf8' });
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmpPath, authPath);
  fsyncDir(path.dirname(authPath));

  const stat = fs.statSync(authPath);
  return { mtime: stat.mtimeMs };
}

/**
 * Write raw auth.json text with mtime check (async).
 */
export async function writeRaw(
  text: string,
  expectedMtime: number | undefined,
  options?: PiAuthStoreOptions
): Promise<PiWriteRawResult> {
  return writeRawSync(text, expectedMtime, options);
}
