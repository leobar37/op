import { z } from 'zod';

export const DroidCustomModelSchema = z.object({
  model: z.string().min(1, 'model is required'),
  displayName: z.string().min(1, 'displayName is required'),
  baseUrl: z.string().url('baseUrl must be a valid URL'),
  apiKey: z.string().min(1, 'apiKey is required'),
  provider: z.enum(['anthropic', 'openai', 'generic-chat-completion-api']),
  maxOutputTokens: z.number().optional(),
  reasoningOverride: z.union([z.string(), z.number()]).optional(),
});

export type DroidCustomModel = z.infer<typeof DroidCustomModelSchema>;

export interface DroidManagedModelRef {
  profile: string;
  displayName: string;
  index: number;
  selectorAlias: string;
  selector: string;
}

export interface DroidCustomModelEntry {
  model: string;
  displayName: string;
  baseUrl: string;
  apiKey: string;
  provider: string;
  maxOutputTokens?: number;
  extraArgs?: Record<string, unknown>;
  extra_args?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DroidSettings {
  model?: string;
  customModels?: DroidCustomModelEntry[];
  sessionDefaultSettings?: Record<string, unknown>;
  hooks?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DroidSettingsStoreOptions {
  homeDir?: string;
  env?: NodeJS.ProcessEnv;
}

export interface ReadRawResult {
  text: string;
  mtime: number;
}

export interface WriteRawResult {
  mtime: number;
}
