import { getModelThinkingSupport } from '../cliproxy/model-catalog';
import { validateThinking } from '../cliproxy/thinking-validator';
import { stripModelConfigurationSuffixes } from '../shared/extended-context-utils';
import type { DroidCustomModel, DroidCustomModelEntry } from './types';

const DROID_REASONING_OFF_VALUES = new Set(['off', 'none', 'disabled', '0']);
const DROID_ANTHROPIC_BUDGET_BY_EFFORT: Record<string, number> = {
  minimal: 4000,
  low: 4000,
  medium: 12000,
  high: 30000,
  max: 50000,
  xhigh: 64000,
  auto: 30000,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isReasoningOffValue(value: string | number): boolean {
  if (typeof value === 'number') return value <= 0;
  const normalized = value.trim().toLowerCase();
  return DROID_REASONING_OFF_VALUES.has(normalized);
}

function toAnthropicBudget(value: string | number): number {
  if (typeof value === 'number') {
    return Math.max(1024, Math.floor(value));
  }

  const normalized = value.trim().toLowerCase();
  if (/^\d+$/.test(normalized)) {
    return Math.max(1024, Number.parseInt(normalized, 10));
  }

  return DROID_ANTHROPIC_BUDGET_BY_EFFORT[normalized] ?? DROID_ANTHROPIC_BUDGET_BY_EFFORT.high;
}

function resolveAnthropicModelId(model: string): string {
  return stripModelConfigurationSuffixes(model);
}

function usesAnthropicAdaptiveThinking(model: string): boolean {
  return getModelThinkingSupport('claude', resolveAnthropicModelId(model))?.type === 'levels';
}

function toAnthropicAdaptiveEffort(model: string, value: string | number): string | undefined {
  const validation = validateThinking('claude', resolveAnthropicModelId(model), value);
  if (isReasoningOffValue(validation.value)) {
    return undefined;
  }

  const normalized = String(validation.value).trim().toLowerCase();
  return normalized === 'auto' ? undefined : normalized;
}

function toReasoningEffort(value: string | number): string {
  if (typeof value === 'number') {
    if (value <= 4000) return 'low';
    if (value <= 12000) return 'medium';
    if (value <= 30000) return 'high';
    if (value <= 50000) return 'max';
    return 'xhigh';
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) return 'high';
  return normalized;
}

export function applyReasoningOverride(
  entry: DroidCustomModelEntry,
  provider: DroidCustomModel['provider'],
  reasoningOverride: string | number
): void {
  const extraArgsKey: 'extraArgs' | 'extra_args' = Object.prototype.hasOwnProperty.call(
    entry,
    'extra_args'
  )
    ? 'extra_args'
    : 'extraArgs';
  const currentExtraArgs = entry[extraArgsKey];
  const extraArgs = isObject(currentExtraArgs) ? { ...currentExtraArgs } : {};

  delete extraArgs.reasoningEffort;

  if (provider === 'anthropic') {
    delete extraArgs.reasoning;
    delete extraArgs.reasoning_effort;

    if (isReasoningOffValue(reasoningOverride)) {
      delete extraArgs.thinking;
      delete extraArgs.output_config;
    } else if (usesAnthropicAdaptiveThinking(entry.model)) {
      const thinking = isObject(extraArgs.thinking) ? { ...extraArgs.thinking } : {};
      const outputConfig = isObject(extraArgs.output_config) ? { ...extraArgs.output_config } : {};
      const effort = toAnthropicAdaptiveEffort(entry.model, reasoningOverride);

      thinking.type = 'adaptive';
      delete thinking.budget_tokens;
      delete thinking.budgetTokens;

      if (effort) {
        outputConfig.effort = effort;
      } else {
        delete outputConfig.effort;
      }

      extraArgs.thinking = thinking;
      if (Object.keys(outputConfig).length > 0) {
        extraArgs.output_config = outputConfig;
      } else {
        delete extraArgs.output_config;
      }
    } else {
      const thinking = isObject(extraArgs.thinking) ? { ...extraArgs.thinking } : {};
      thinking.type = 'enabled';
      thinking.budget_tokens = toAnthropicBudget(reasoningOverride);
      delete thinking.budgetTokens;
      extraArgs.thinking = thinking;
      delete extraArgs.output_config;
    }
  } else if (provider === 'openai') {
    delete extraArgs.reasoning_effort;
    delete extraArgs.thinking;

    if (isReasoningOffValue(reasoningOverride)) {
      delete extraArgs.reasoning;
    } else {
      const reasoning = isObject(extraArgs.reasoning) ? { ...extraArgs.reasoning } : {};
      reasoning.effort = toReasoningEffort(reasoningOverride);
      extraArgs.reasoning = reasoning;
    }
  } else {
    delete extraArgs.reasoning;
    delete extraArgs.thinking;

    if (isReasoningOffValue(reasoningOverride)) {
      delete extraArgs.reasoning_effort;
    } else {
      extraArgs.reasoning_effort = toReasoningEffort(reasoningOverride);
    }
  }

  if (Object.keys(extraArgs).length === 0) {
    delete entry.extraArgs;
    delete entry.extra_args;
    return;
  }

  entry[extraArgsKey] = extraArgs;
}
