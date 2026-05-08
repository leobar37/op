/**
 * API Key Target Applicator Registry
 *
 * Extensible registry for per-target API key application logic.
 * Each target (claude, droid, pi) registers a direct and proxy applicator.
 * New targets add a module here rather than modifying the dispatch function.
 */

import type { ApiKeyProfile, ApplyApiKeyResult, ApiKeyStrategy } from '../api-key-types';
import { claudeApplicator } from './claude-applicator';
import { droidApplicator } from './droid-applicator';
import { piApplicator } from './pi-applicator';
import type { TargetType } from '../../../targets/target-adapter';

/** Applicator function signature: applies a profile to a target with a strategy. */
export type TargetApplicatorFn = (profile: ApiKeyProfile) => Promise<ApplyApiKeyResult>;

/** Per-target applicator record with direct and proxy variants. */
export interface TargetApplicatorRecord {
  direct: TargetApplicatorFn;
  proxy: TargetApplicatorFn;
  /** Human-readable supported strategies for error messages. */
  supportedStrategies: readonly ApiKeyStrategy[];
}

/** Registry of all target applicators, keyed by TargetType. */
const applicatorRegistry: Partial<Record<TargetType, TargetApplicatorRecord>> = {
  claude: claudeApplicator,
  droid: droidApplicator,
  pi: piApplicator,
};

/**
 * Look up the applicator record for a target.
 * Returns null if the target has no registered applicator.
 */
export function getApplicatorRecord(target: TargetType): TargetApplicatorRecord | null {
  return applicatorRegistry[target] ?? null;
}

/**
 * Get the list of target types that have registered applicators.
 */
export function getSupportedApplyTargets(): TargetType[] {
  return Object.keys(applicatorRegistry) as TargetType[];
}

/**
 * Apply an API key profile to a target with the given strategy.
 * Returns an error result if the target or strategy is not supported.
 */
export async function dispatchApply(
  profile: ApiKeyProfile,
  target: TargetType,
  strategy: ApiKeyStrategy
): Promise<ApplyApiKeyResult> {
  const record = getApplicatorRecord(target);

  if (!record) {
    return {
      success: false,
      target,
      strategy,
      error: `Target '${target}' is not supported for API key application. Supported targets: ${getSupportedApplyTargets().join(', ')}`,
    };
  }

  if (strategy !== 'direct' && strategy !== 'proxy') {
    return {
      success: false,
      target,
      strategy,
      error: `Strategy '${strategy}' is not supported. Use 'direct' or 'proxy'.`,
    };
  }

  if (!record.supportedStrategies.includes(strategy)) {
    return {
      success: false,
      target,
      strategy,
      error: `Strategy '${strategy}' is not supported for target '${target}'. Supported strategies: ${record.supportedStrategies.join(', ')}`,
    };
  }

  return record[strategy](profile);
}
