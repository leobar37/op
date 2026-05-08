import * as os from 'os';
import * as path from 'path';

export interface PiPathsOptions {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
}

export interface PiConfigPaths {
  piDir: string;
  agentDir: string;
  authPath: string;
  agentsPath: string;
  settingsPath: string;
  piDirDisplayPath: string;
  agentDirDisplayPath: string;
  authDisplayPath: string;
  agentsDisplayPath: string;
  settingsDisplayPath: string;
}

export function resolvePiConfigPaths(options: PiPathsOptions = {}): PiConfigPaths {
  const env = options.env ?? process.env;
  const homeDir = options.homeDir ?? os.homedir();
  const piDir = env.PI_HOME?.trim() || path.join(homeDir, '.pi');
  const agentDir = path.join(piDir, 'agent');

  const piDirDisplayPath = env.PI_HOME?.trim() ? '$PI_HOME' : '~/.pi';
  const agentDirDisplayPath = `${piDirDisplayPath}/agent`;

  return {
    piDir,
    agentDir,
    authPath: path.join(agentDir, 'auth.json'),
    agentsPath: path.join(agentDir, 'AGENTS.md'),
    settingsPath: path.join(agentDir, 'settings.json'),
    piDirDisplayPath,
    agentDirDisplayPath,
    authDisplayPath: `${agentDirDisplayPath}/auth.json`,
    agentsDisplayPath: `${agentDirDisplayPath}/AGENTS.md`,
    settingsDisplayPath: `${agentDirDisplayPath}/settings.json`,
  };
}

export function getPiDir(options?: PiPathsOptions): string {
  return resolvePiConfigPaths(options).piDir;
}

export function getPiAgentDir(options?: PiPathsOptions): string {
  return resolvePiConfigPaths(options).agentDir;
}

export function getPiAuthPath(options?: PiPathsOptions): string {
  return resolvePiConfigPaths(options).authPath;
}
