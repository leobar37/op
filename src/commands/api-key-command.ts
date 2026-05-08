/**
 * API Key Command
 *
 * Manage API key profiles - source of truth for provider credentials.
 * Commands: create, list, remove, apply
 */

import {
  createApiKeyProfile,
  removeApiKeyProfile,
  applyApiKeyProfile,
  listApiKeyProfiles,
  getApiKeyProfile,
} from '../api/services/api-key-service';
import { getPresetById } from '../api/services';
import type { TargetType } from '../targets/target-adapter';
import { color, dim, fail, header, info, infoBox, initUI, ok } from '../utils/ui';
import { InteractivePrompt } from '../utils/prompt';

function parseApiKeyCommandArgs(args: string[]): {
  command?: string;
  id?: string;
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  target?: TargetType;
  strategy?: 'direct' | 'proxy';
  force?: boolean;
  yes?: boolean;
  errors: string[];
} {
  const result: ReturnType<typeof parseApiKeyCommandArgs> = { errors: [] };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.command = 'help';
      return result;
    }

    if (arg === '--provider') {
      result.provider = args[++i];
    } else if (arg === '--key' || arg === '--api-key') {
      result.apiKey = args[++i];
    } else if (arg === '--base-url') {
      result.baseUrl = args[++i];
    } else if (arg === '--model') {
      result.model = args[++i];
    } else if (arg === '--target') {
      result.target = args[++i] as TargetType;
    } else if (arg === '--strategy') {
      result.strategy = args[++i] as 'direct' | 'proxy';
    } else if (arg === '--force' || arg === '-f') {
      result.force = true;
    } else if (arg === '--yes' || arg === '-y') {
      result.yes = true;
    } else if (!result.command && !arg.startsWith('--')) {
      result.command = arg;
    } else if (result.command && !result.id && !arg.startsWith('--')) {
      result.id = arg;
    } else {
      result.errors.push(`Unknown option: ${arg}`);
    }
  }

  return result;
}

async function resolveProvider(parsed: ReturnType<typeof parseApiKeyCommandArgs>): Promise<string> {
  if (parsed.provider) {
    const preset = getPresetById(parsed.provider);
    if (preset) {
      return preset.id;
    }
    console.log(fail(`Unknown provider preset: ${parsed.provider}`));
    process.exit(1);
  }

  const presets = [
    { id: 'deepseek', name: 'DeepSeek' },
    { id: 'kimi', name: 'Kimi (Moonshot)' },
    { id: 'glm', name: 'GLM (Z.AI)' },
    { id: 'mm', name: 'Minimax' },
    { id: 'qwen', name: 'Qwen (Alibaba)' },
    { id: 'anthropic', name: 'Anthropic (Direct)' },
    { id: 'huggingface', name: 'Hugging Face' },
    { id: 'foundry', name: 'Azure Foundry' },
    { id: 'novita', name: 'Novita AI' },
  ];

  console.log(info('Select a provider:'));
  presets.forEach((p, i) => {
    console.log(`  ${color(`${i + 1}`, 'command')}. ${p.name}`);
  });

  const choice = await InteractivePrompt.input('Provider number', {
    default: '1',
    validate: (v) => {
      const n = parseInt(v, 10);
      return n >= 1 && n <= presets.length ? null : 'Invalid choice';
    },
  });

  return presets[parseInt(choice, 10) - 1].id;
}

async function resolveApiKeyId(
  parsed: ReturnType<typeof parseApiKeyCommandArgs>,
  provider: string
): Promise<string> {
  if (parsed.id) {
    return parsed.id;
  }

  const defaultId = `${provider}-api`;
  return InteractivePrompt.input('API Key ID', {
    default: defaultId,
    validate: (v) => {
      if (!v || v.trim().length === 0) return 'ID is required';
      if (!/^[a-zA-Z0-9._-]+$/.test(v)) {
        return 'ID must contain only alphanumeric characters, dots, underscores, or hyphens';
      }
      return null;
    },
  });
}

async function resolveApiKey(parsed: ReturnType<typeof parseApiKeyCommandArgs>): Promise<string> {
  if (parsed.apiKey) {
    return parsed.apiKey;
  }
  const key = await InteractivePrompt.password('API Key');
  if (!key) {
    console.log(fail('API key is required'));
    process.exit(1);
  }
  return key;
}

async function resolveBaseUrl(
  provider: string,
  parsed: ReturnType<typeof parseApiKeyCommandArgs>
): Promise<string> {
  if (parsed.baseUrl) {
    return parsed.baseUrl;
  }

  const preset = getPresetById(provider);
  if (preset?.baseUrl) {
    console.log(info(`Using preset base URL: ${preset.baseUrl}`));
    return preset.baseUrl;
  }

  return InteractivePrompt.input('Base URL', {
    default: '',
  });
}

async function resolveModel(
  provider: string,
  parsed: ReturnType<typeof parseApiKeyCommandArgs>
): Promise<string> {
  if (parsed.model) {
    return parsed.model;
  }

  const preset = getPresetById(provider);
  if (preset?.defaultModel) {
    console.log(info(`Using preset default model: ${preset.defaultModel}`));
    return preset.defaultModel;
  }

  return InteractivePrompt.input('Default model', {
    default: 'claude-sonnet-4-5',
  });
}

async function resolveTarget(
  parsed: ReturnType<typeof parseApiKeyCommandArgs>
): Promise<TargetType> {
  if (parsed.target) {
    return parsed.target;
  }

  const useDroid = await InteractivePrompt.confirm('Set default target to Factory Droid?', {
    default: true,
  });
  return useDroid ? 'droid' : 'claude';
}

async function handleApiKeyCreate(args: string[]): Promise<void> {
  await initUI();
  const parsed = parseApiKeyCommandArgs(args);

  if (parsed.errors.length > 0) {
    parsed.errors.forEach((e) => console.log(fail(e)));
    process.exit(1);
  }

  console.log(header('Create API Key Profile'));
  console.log('');

  const provider = await resolveProvider(parsed);
  const id = await resolveApiKeyId(parsed, provider);

  if (!parsed.force && getApiKeyProfile(id)) {
    console.log(fail(`API key profile '${id}' already exists`));
    console.log(`    Use ${color('--force', 'command')} to overwrite`);
    process.exit(1);
  }

  const apiKey = await resolveApiKey(parsed);
  const baseUrl = await resolveBaseUrl(provider, parsed);
  const model = await resolveModel(provider, parsed);
  const target = await resolveTarget(parsed);

  console.log('');
  console.log(info('Creating API key profile...'));

  const result = createApiKeyProfile({
    id,
    provider,
    apiKey,
    baseUrl,
    defaultModel: model,
    target,
  });

  if (!result.success) {
    console.log(fail(`Failed to create API key profile: ${result.error}`));
    process.exit(1);
  }

  const details =
    `ID:       ${id}\n` +
    `Provider: ${provider}\n` +
    `Base URL: ${baseUrl}\n` +
    `Model:    ${model}\n` +
    `Target:   ${target}`;

  console.log('');
  console.log(infoBox(details, 'API Key Profile Created'));
  console.log('');
  console.log(header('Usage'));
  console.log(
    `  ${color(`ccs api-key apply ${id} --target ${target} --strategy direct`, 'command')}`
  );
  console.log(
    `  ${color(`ccs api-key apply ${id} --target ${target} --strategy proxy`, 'command')}`
  );
  console.log('');
}

async function handleApiKeyList(): Promise<void> {
  await initUI();
  const result = listApiKeyProfiles();

  console.log(header('API Key Profiles'));
  console.log('');

  if (result.profiles.length === 0) {
    console.log(dim('No API key profiles found.'));
    console.log('');
    console.log(`Create one with: ${color('ccs api-key create', 'command')}`);
    return;
  }

  const idWidth = Math.max(...result.profiles.map((p) => p.id.length)) + 2;
  const providerWidth = Math.max(...result.profiles.map((p) => p.provider.length)) + 2;

  console.log(
    `${color('ID', 'command').padEnd(idWidth)} ${color('Provider', 'command').padEnd(providerWidth)} ${color('Model', 'command')} ${color('Target', 'command')}`
  );
  console.log(dim('-'.repeat(idWidth + providerWidth + 30)));

  for (const profile of result.profiles) {
    const id = profile.id.padEnd(idWidth);
    const provider = profile.provider.padEnd(providerWidth);
    const model = profile.defaultModel;
    const target = profile.target;
    console.log(`  ${id} ${provider} ${model} ${target}`);
  }

  console.log('');
  console.log(
    `Apply with: ${color('ccs api-key apply <id> --target <claude|droid|pi> --strategy <direct|proxy>', 'command')}`
  );
}

async function handleApiKeyRemove(args: string[]): Promise<void> {
  await initUI();
  const parsed = parseApiKeyCommandArgs(args);

  if (!parsed.id) {
    console.log(fail('API key profile ID is required'));
    console.log(`Usage: ${color('ccs api-key remove <id>', 'command')}`);
    process.exit(1);
  }

  const result = removeApiKeyProfile(parsed.id);
  if (!result.success) {
    console.log(fail(`Failed to remove API key profile: ${result.error}`));
    process.exit(1);
  }

  console.log(ok(`API key profile '${parsed.id}' removed`));
}

async function handleApiKeyApply(args: string[]): Promise<void> {
  await initUI();
  const parsed = parseApiKeyCommandArgs(args);

  if (!parsed.id) {
    console.log(fail('API key profile ID is required'));
    console.log(
      `Usage: ${color('ccs api-key apply <id> --target <claude|droid|pi> --strategy <direct|proxy>', 'command')}`
    );
    process.exit(1);
  }

  const profile = getApiKeyProfile(parsed.id);
  if (!profile) {
    console.log(fail(`API key profile '${parsed.id}' not found`));
    process.exit(1);
  }

  let target = parsed.target;
  if (!target) {
    target = profile.target;
    console.log(info(`Using default target: ${target}`));
  }

  let strategy = parsed.strategy;
  if (!strategy) {
    strategy = target === 'droid' ? 'direct' : 'proxy';
    console.log(info(`Using default strategy for ${target}: ${strategy}`));
  }

  console.log('');
  console.log(info(`Applying API key profile '${parsed.id}' to ${target} (${strategy})...`));

  const result = await applyApiKeyProfile(parsed.id, target, strategy);

  if (!result.success) {
    console.log(fail(`Failed to apply API key profile: ${result.error}`));
    process.exit(1);
  }

  console.log('');
  console.log(ok(`Applied '${parsed.id}' to ${target} with ${strategy} strategy`));
  if (result.configPath) {
    console.log(dim(`  Config written to: ${result.configPath}`));
  }
}

export async function showApiKeyHelp(): Promise<void> {
  await initUI();
  console.log(header('CCS API Key Management'));
  console.log('');
  console.log('Manage API key profiles - source of truth for provider credentials.');
  console.log('');
  console.log(subheaderText('Usage'));
  console.log(`  ${color('ccs api-key', 'command')} <command> [options]`);
  console.log('');
  console.log(subheaderText('Commands'));
  console.log(`  ${color('create', 'command')}     Create a new API key profile`);
  console.log(`  ${color('list', 'command')}       List all API key profiles`);
  console.log(`  ${color('remove', 'command')}     Remove an API key profile`);
  console.log(`  ${color('apply', 'command')}      Apply an API key profile to a target`);
  console.log('');
  console.log(subheaderText('Options'));
  console.log(
    `  ${color('--provider <id>', 'command')}   Provider preset (deepseek, kimi, glm, etc.)`
  );
  console.log(`  ${color('--key <key>', 'command')}       API key`);
  console.log(`  ${color('--base-url <url>', 'command')}  Base URL for the provider`);
  console.log(`  ${color('--model <model>', 'command')}   Default model`);
  console.log(`  ${color('--target <type>', 'command')}   Target: claude, droid, or pi`);
  console.log(`  ${color('--strategy <type>', 'command')} Strategy: direct or proxy`);
  console.log(`  ${color('--force, -f', 'command')}      Overwrite existing profile`);
  console.log(`  ${color('--yes, -y', 'command')}        Skip confirmation prompts`);
  console.log('');
  console.log(subheaderText('Examples'));
  console.log(`  ${dim('# Interactive creation')}`);
  console.log(`  ${color('ccs api-key create', 'command')}`);
  console.log('');
  console.log(`  ${dim('# Quick creation with preset')}`);
  console.log(`  ${color('ccs api-key create --provider deepseek --key sk-xxx', 'command')}`);
  console.log('');
  console.log(`  ${dim('# Apply to Droid with direct strategy')}`);
  console.log(
    `  ${color('ccs api-key apply deepseek-api --target droid --strategy direct', 'command')}`
  );
  console.log('');
  console.log(`  ${dim('# Apply to Claude with proxy strategy')}`);
  console.log(
    `  ${color('ccs api-key apply deepseek-api --target claude --strategy proxy', 'command')}`
  );
  console.log('');
  console.log(`  ${dim('# Apply to Pi with direct strategy')}`);
  console.log(
    `  ${color('ccs api-key apply deepseek-api --target pi --strategy direct', 'command')}`
  );
  console.log('');
}

function subheaderText(text: string): string {
  return color(text, 'info');
}

export async function handleApiKeyCommand(args: string[]): Promise<void> {
  const command = args[0];

  switch (command) {
    case 'create':
      await handleApiKeyCreate(args.slice(1));
      break;
    case 'list':
      await handleApiKeyList();
      break;
    case 'remove':
    case 'delete':
    case 'rm':
      await handleApiKeyRemove(args.slice(1));
      break;
    case 'apply':
      await handleApiKeyApply(args.slice(1));
      break;
    case '--help':
    case '-h':
    case 'help':
    default:
      await showApiKeyHelp();
      break;
  }
}
