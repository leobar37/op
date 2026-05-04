import * as path from 'path';
import * as os from 'os';

export interface DroidPathsOptions {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
}

export interface DroidConfigPaths {
  settingsPath: string;
  settingsDisplayPath: string;
  legacyConfigPath: string;
  legacyConfigDisplayPath: string;
  factoryDir: string;
}

export function resolveDroidConfigPaths(options: DroidPathsOptions = {}): DroidConfigPaths {
  const env = options.env ?? process.env;
  const homeDir = options.homeDir ?? os.homedir();

  const byokBase = env.CCS_HOME || homeDir;
  const factoryDir = path.join(byokBase, '.factory');
  const settingsPath = path.join(factoryDir, 'settings.json');
  const legacyConfigPath = path.join(factoryDir, 'config.json');

  return {
    factoryDir,
    settingsPath,
    settingsDisplayPath: '~/.factory/settings.json',
    legacyConfigPath,
    legacyConfigDisplayPath: '~/.factory/config.json',
  };
}

export function getFactoryDir(options?: DroidPathsOptions): string {
  return resolveDroidConfigPaths(options).factoryDir;
}

export function getSettingsPath(options?: DroidPathsOptions): string {
  return resolveDroidConfigPaths(options).settingsPath;
}
