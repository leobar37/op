export type { PiConfigPaths, PiPathsOptions } from './paths';
export { getPiAgentDir, getPiAuthPath, getPiDir, resolvePiConfigPaths } from './paths';

export type {
  PiAuthStore,
  PiAuthEntry,
  PiApiKeyEntry,
  PiOAuthEntry,
  PiAuthType,
  PiRedactedAuthStore,
  PiRedactedAuthEntry,
  PiAuthStoreOptions,
  PiReadRawResult,
  PiWriteRawResult,
} from './types';

export {
  readPiAuth,
  readPiAuthSync,
  writePiAuth,
  writePiAuthSync,
  mergePiAuth,
  mergePiAuthSync,
  removePiAuthProviders,
  removePiAuthProvidersSync,
  redactAuthEntry,
  redactAuthStore,
  readRaw,
  readRawSync,
  writeRaw,
  writeRawSync,
} from './auth';

export type { PiAuthProviderKey } from './provider-mapping';
export {
  mapCcsProviderToPiAuthProvider,
  getSupportedCcsProviderIds,
  getSupportedPiAuthProviderKeys,
  isSupportedCcsProviderForPi,
} from './provider-mapping';
