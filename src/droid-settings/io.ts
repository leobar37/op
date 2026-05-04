import * as fs from 'fs';
import * as path from 'path';
import * as lockfile from 'proper-lockfile';
import type { DroidSettings, DroidCustomModelEntry, ReadRawResult, WriteRawResult } from './types';
import { getFactoryDir, getSettingsPath } from './paths';
import type { DroidPathsOptions } from './paths';

const LOCK_STALE_MS = 10000;
const LOCK_RETRY_MIN_MS = 200;
const LOCK_RETRY_MAX_MS = 1000;

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
      throw new Error('Refusing to read: settings.json is not a regular file');
    }
    return fs.readFileSync(fd, 'utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDroidCustomModelEntry(value: unknown): value is DroidCustomModelEntry {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.displayName === 'string' &&
    record.displayName.trim() !== '' &&
    typeof record.model === 'string' &&
    typeof record.baseUrl === 'string' &&
    typeof record.apiKey === 'string' &&
    typeof record.provider === 'string' &&
    record.provider.trim() !== ''
  );
}

function asModelEntry(value: unknown): DroidCustomModelEntry | null {
  return isDroidCustomModelEntry(value) ? value : null;
}

export function normalizeCustomModels(value: unknown): DroidCustomModelEntry[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => asModelEntry(entry))
      .filter((entry): entry is DroidCustomModelEntry => !!entry);
  }

  if (value && typeof value === 'object') {
    return Object.values(value)
      .map((entry) => asModelEntry(entry))
      .filter((entry): entry is DroidCustomModelEntry => !!entry);
  }

  return [];
}

function ensureFactoryDir(options?: DroidPathsOptions): void {
  const dir = getFactoryDir(options);
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code !== 'EEXIST') throw error;
  }
}

export function readDroidSettingsSync(options?: DroidPathsOptions): DroidSettings {
  const settingsPath = getSettingsPath(options);
  if (!fs.existsSync(settingsPath)) {
    return { customModels: [] };
  }

  const fileStat = fs.lstatSync(settingsPath);
  if (fileStat.isSymbolicLink()) {
    throw new Error('Refusing to read: settings.json is a symlink');
  }
  if (!fileStat.isFile()) {
    throw new Error('Refusing to read: settings.json is not a regular file');
  }

  const raw = readFileUtf8NoFollow(settingsPath);
  try {
    const parsed = JSON.parse(raw) as DroidSettings;
    return {
      ...parsed,
      customModels: normalizeCustomModels((parsed as { customModels?: unknown }).customModels),
    };
  } catch {
    const backup = settingsPath + '.bak';
    try {
      fs.copyFileSync(settingsPath, backup);
      fs.chmodSync(backup, 0o600);
      console.warn(`[!] Corrupted ${settingsPath}, backed up to ${backup}`);
    } catch (error) {
      console.warn(`[!] Corrupted ${settingsPath}; backup failed: ${(error as Error).message}`);
    }
    return { customModels: [] };
  }
}

export async function readDroidSettings(options?: DroidPathsOptions): Promise<DroidSettings> {
  return readDroidSettingsSync(options);
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

export function writeDroidSettingsSync(settings: DroidSettings, options?: DroidPathsOptions): void {
  ensureFactoryDir(options);
  const settingsPath = getSettingsPath(options);

  if (fs.existsSync(settingsPath)) {
    const stat = fs.lstatSync(settingsPath);
    if (stat.isSymbolicLink()) {
      throw new Error('Refusing to write: settings.json is a symlink');
    }
  }

  const tmpPath = settingsPath + '.tmp';
  if (fs.existsSync(tmpPath)) {
    const tmpStat = fs.lstatSync(tmpPath);
    if (tmpStat.isSymbolicLink()) {
      throw new Error('Refusing to write: settings.json.tmp is a symlink');
    }
  }

  const payload = JSON.stringify(
    {
      ...settings,
      customModels: normalizeCustomModels((settings as { customModels?: unknown }).customModels),
    },
    null,
    2
  );
  const fd = openFileNoFollow(
    tmpPath,
    fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC,
    0o600
  );
  try {
    const tmpFdStat = fs.fstatSync(fd);
    if (!tmpFdStat.isFile()) {
      throw new Error('Refusing to write: settings.json.tmp is not a regular file');
    }
    fs.writeFileSync(fd, payload + '\n', { encoding: 'utf8' });
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmpPath, settingsPath);
  fsyncDir(path.dirname(settingsPath));

  try {
    const stat = fs.statSync(settingsPath);
    if (stat.mode & 0o077) {
      fs.chmodSync(settingsPath, 0o600);
      console.warn('[!] Fixed permissions on ~/.factory/settings.json (was world-readable)');
    }
  } catch {
    // Best-effort permission check
  }
}

export async function writeDroidSettings(
  settings: DroidSettings,
  options?: DroidPathsOptions
): Promise<void> {
  writeDroidSettingsSync(settings, options);
}

export async function acquireFactoryLock(
  options: DroidPathsOptions & { retries?: number } = {}
): Promise<() => Promise<void>> {
  ensureFactoryDir(options);
  const factoryDir = getFactoryDir(options);
  const retries = options.retries ?? 10;
  try {
    return await lockfile.lock(factoryDir, {
      stale: LOCK_STALE_MS,
      retries: { retries, minTimeout: LOCK_RETRY_MIN_MS, maxTimeout: LOCK_RETRY_MAX_MS },
    });
  } catch (error) {
    throw new Error(
      `Failed to lock Droid settings directory (${factoryDir}): ${(error as Error).message}`
    );
  }
}

export function readRawSync(options?: DroidPathsOptions): ReadRawResult {
  const settingsPath = getSettingsPath(options);
  if (!fs.existsSync(settingsPath)) {
    return { text: '{}', mtime: Date.now() };
  }

  const stat = fs.lstatSync(settingsPath);
  if (stat.isSymbolicLink()) {
    throw new Error('Refusing to read: settings.json is a symlink');
  }
  if (!stat.isFile()) {
    throw new Error('Refusing to read: settings.json is not a regular file');
  }

  const text = readFileUtf8NoFollow(settingsPath);
  return { text, mtime: stat.mtimeMs };
}

export async function readRaw(options?: DroidPathsOptions): Promise<ReadRawResult> {
  return readRawSync(options);
}

export function writeRawSync(
  text: string,
  expectedMtime: number | undefined,
  options?: DroidPathsOptions
): WriteRawResult {
  ensureFactoryDir(options);
  const settingsPath = getSettingsPath(options);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON: ${(error as Error).message}`);
  }

  if (!isObject(parsed)) {
    throw new Error('JSON root must be an object');
  }

  if (fs.existsSync(settingsPath) && expectedMtime !== undefined) {
    const stat = fs.lstatSync(settingsPath);
    if (stat.isSymbolicLink()) {
      throw new Error('Refusing to write: settings.json is a symlink');
    }
    if (Math.abs(stat.mtimeMs - expectedMtime) > 1000) {
      throw new Error('File modified externally');
    }
  }

  const tmpPath = settingsPath + '.tmp';
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
  fs.renameSync(tmpPath, settingsPath);
  fsyncDir(path.dirname(settingsPath));

  const stat = fs.statSync(settingsPath);
  return { mtime: stat.mtimeMs };
}

export async function writeRaw(
  text: string,
  expectedMtime: number | undefined,
  options?: DroidPathsOptions
): Promise<WriteRawResult> {
  return writeRawSync(text, expectedMtime, options);
}
