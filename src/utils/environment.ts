/**
 * @fileoverview Environment variable loader for React, Angular, and VITE projects
 *
 * This module handles loading framework-specific environment variables from:
 * - .env files (React/VITE)
 * - environment.ts files (Angular)
 * - Process environment variables
 *
 * Note: This is different from node-env-manager.ts which only handles NODE_ENV setup/restore.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ENV_PREFIXES, ENVIRONMENT_FILES, REGEX_PATTERNS } from '../constants';
import { isAngularProject, isReactProject, detectProjectType } from './project-detection';

/**
 * Environment variables map
 */
type EnvironmentVariables = Record<string, string | undefined>;

/**
 * Logger interface
 */
interface Logger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * Debug logger
 */
const createLogger = (debugEnabled: boolean = process.env['DEBUG'] === 'arc-spa-csp'): Logger => ({
  log: (message: string): void => {
    if (debugEnabled) {
      // eslint-disable-next-line no-console
      console.log(`[DEBUG] ${message}`);
    }
  },
  warn: (message: string): void => {
    if (debugEnabled) {
      // eslint-disable-next-line no-console
      console.warn(`[WARN] ${message}`);
    }
  },
  error: (message: string): void => {
    if (debugEnabled) {
      // eslint-disable-next-line no-console
      console.error(`[ERROR] ${message}`);
    }
  },
});

const logger = createLogger();

// ============================================================================
// CORE NODE_ENV UTILITIES
// ============================================================================

export const getNodeEnv = (): string | undefined => process.env['NODE_ENV'];

export const setNodeEnv = (value: string): void => {
  if (typeof value !== 'string') {
    throw new Error('NODE_ENV value must be a string');
  }
  process.env['NODE_ENV'] = value;
};

export const deleteNodeEnv = (): void => {
  delete process.env['NODE_ENV'];
};

export const isProduction = (): boolean => getNodeEnv() === 'production';

export const isDevelopment = (): boolean => getNodeEnv() === 'development';

// ============================================================================
// VALIDATION AND UTILITIES
// ============================================================================

const isValidEnvironmentValue = (value: string | undefined): value is string => {
  return (
    Boolean(value) &&
    typeof value === 'string' &&
    value.trim() !== '' &&
    value !== 'undefined' &&
    value !== 'null' &&
    !value.match(/^['"]?\s*['"]?$/)
  );
};

const camelCaseToUpperCase = (str: string): string => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/([A-Z])/g, '_$1')
    .toUpperCase()
    .replace(/^_/, '');
};

const filterValidEnvironmentVariables = (envVars: EnvironmentVariables): EnvironmentVariables => {
  if (!envVars || typeof envVars !== 'object') return {};
  const filtered: EnvironmentVariables = {};
  for (const [key, value] of Object.entries(envVars)) {
    if (isValidEnvironmentValue(value)) {
      filtered[key] = value;
    }
  }
  return filtered;
};

// ============================================================================
// REACT/VITE ENVIRONMENT LOADING
// ============================================================================

export const parseEnvFile = (envPath: string, prefix: string): EnvironmentVariables => {
  const envVars: EnvironmentVariables = {};
  if (typeof envPath !== 'string' || typeof prefix !== 'string') return envVars;

  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;

      const match = REGEX_PATTERNS.ENV_FILE_LINE.exec(trimmedLine);
      if (match?.[1]?.startsWith(prefix)) {
        const key = match[1];
        const value = (match[2] ?? '').replace(/^["'](.*)["']$/, '$1');
        envVars[key] = value;
      }
    }
  } catch (error) {
    logger.warn(
      `parseEnvFile: Failed to read ${envPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
  return envVars;
};

export const loadReactEnv = (projectRoot: string): EnvironmentVariables => {
  if (typeof projectRoot !== 'string') projectRoot = process.cwd();

  const envVars: EnvironmentVariables = {};
  const envMode = isProduction() ? 'production' : 'development';
  const envFiles = ['.env', `.env.${envMode}`, '.env.local', `.env.${envMode}.local`];

  for (const envFile of envFiles) {
    const envPath = path.join(projectRoot, envFile);
    if (fs.existsSync(envPath)) {
      Object.assign(envVars, parseEnvFile(envPath, ENV_PREFIXES.REACT));
      Object.assign(envVars, parseEnvFile(envPath, ENV_PREFIXES.VITE));
    }
  }

  // Add process environment variables
  Object.entries(process.env).forEach(([key, value]) => {
    if (
      (key.startsWith(ENV_PREFIXES.REACT) || key.startsWith(ENV_PREFIXES.VITE)) &&
      value !== undefined
    ) {
      envVars[key] = value;
    }
  });

  return envVars;
};

// ============================================================================
// ANGULAR ENVIRONMENT LOADING
// ============================================================================

interface AngularWorkspace {
  projects: Record<string, { projectType: string; root: string; sourceRoot: string }>;
}

export const parseAngularEnvFile = (envPath: string): EnvironmentVariables => {
  const envVars: EnvironmentVariables = {};
  if (typeof envPath !== 'string' || !fs.existsSync(envPath)) return envVars;

  try {
    const content = fs.readFileSync(envPath, 'utf8');
    const envMatch = REGEX_PATTERNS.ENVIRONMENT_EXPORT.exec(content);
    if (!envMatch?.[1]) return envVars;

    const propertyRegex = /(\w+):\s*(?:['"]([^'"]*?)['"]|([^,\s}\n]+))\s*,?/g;
    let match: RegExpExecArray | null;

    while ((match = propertyRegex.exec(envMatch[1])) !== null) {
      const key = match[1];
      const value = match[2] ?? match[3] ?? '';

      if (key && isValidEnvironmentValue(value) && value !== 'false' && value !== 'true') {
        let envKey: string;
        if (/^[A-Z0-9_]+$/.test(key)) {
          envKey = `${ENV_PREFIXES.ANGULAR}${key}`;
        } else {
          envKey = `${ENV_PREFIXES.ANGULAR}${camelCaseToUpperCase(key)}`;
        }
        envVars[envKey] = value;
      }
    }
  } catch (error) {
    logger.error(
      `parseAngularEnvFile: Error parsing ${envPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
  return envVars;
};

const loadAngularWorkspace = (projectRoot: string): AngularWorkspace | null => {
  const angularJsonPath = path.join(projectRoot, 'angular.json');
  if (!fs.existsSync(angularJsonPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(angularJsonPath, 'utf8')) as AngularWorkspace;
  } catch (error) {
    logger.warn(
      `Failed to parse angular.json: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return null;
  }
};

const findProjectForHtmlPath = (
  workspace: AngularWorkspace,
  projectRoot: string,
  targetHtmlPath: string,
  envFile: string
): EnvironmentVariables => {
  const normalizedPath = path.normalize(targetHtmlPath);
  for (const [, config] of Object.entries(workspace.projects)) {
    if (config.projectType === 'application') {
      const projectBasePath = path.join(projectRoot, config.root || '');
      const relativePath = path.relative(projectBasePath, normalizedPath);
      if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
        const envPath = path.join(projectRoot, config.sourceRoot || 'src', 'environments', envFile);
        return parseAngularEnvFile(envPath);
      }
    }
  }
  return {};
};

const loadAllWorkspaceProjects = (
  workspace: AngularWorkspace,
  projectRoot: string,
  envFile: string
): EnvironmentVariables => {
  const envVars: EnvironmentVariables = {};
  for (const [, config] of Object.entries(workspace.projects)) {
    if (config.projectType === 'application') {
      const envPath = path.join(projectRoot, config.sourceRoot || 'src', 'environments', envFile);
      Object.assign(envVars, parseAngularEnvFile(envPath));
    }
  }
  return envVars;
};

export const loadAngularEnv = (
  projectRoot: string,
  targetHtmlPath?: string
): EnvironmentVariables => {
  if (typeof projectRoot !== 'string') projectRoot = process.cwd();

  const isProductionMode = isProduction();
  const envFile = isProductionMode ? ENVIRONMENT_FILES.ANGULAR.PROD : ENVIRONMENT_FILES.ANGULAR.DEV;
  const workspace = loadAngularWorkspace(projectRoot);

  // Project-specific loading
  if (workspace && targetHtmlPath) {
    const projectVars = findProjectForHtmlPath(workspace, projectRoot, targetHtmlPath, envFile);
    if (Object.keys(projectVars).length > 0) return projectVars;
  }

  // Workspace-wide loading
  if (workspace) {
    const workspaceVars = loadAllWorkspaceProjects(workspace, projectRoot, envFile);
    if (Object.keys(workspaceVars).length > 0) return workspaceVars;
  }

  // Fallback
  const envPath = path.join(projectRoot, 'src', 'environments', envFile);
  return parseAngularEnvFile(envPath);
};

// ============================================================================
// TEMPLATE UTILITIES
// ============================================================================

export const getFrameworkEnvironmentVariables = (envVars: EnvironmentVariables): string[] => {
  if (!envVars || typeof envVars !== 'object') return [];
  return Object.keys(envVars).filter(
    key =>
      key.startsWith(ENV_PREFIXES.REACT) ||
      key.startsWith(ENV_PREFIXES.VITE) ||
      key.startsWith(ENV_PREFIXES.ANGULAR)
  );
};

export const resolveTemplateVariables = (
  template: string,
  envVars: EnvironmentVariables
): string => {
  if (typeof template !== 'string') return String(template || '');
  if (!envVars || typeof envVars !== 'object') return template;

  const templateRegex = REGEX_PATTERNS.TEMPLATE_VARIABLE;
  if (!templateRegex.test(template)) return template;

  return template.replace(templateRegex, (match, varName: string) => {
    if (!varName || typeof varName !== 'string') return match;
    const value = envVars[varName] ?? envVars[`${ENV_PREFIXES.ANGULAR}${varName}`];
    return value !== undefined ? value : match;
  });
};

// ============================================================================
// MAIN API
// ============================================================================

export const loadEnvironmentVariables = (
  projectRoot: string = process.cwd(),
  targetHtmlPath?: string
): EnvironmentVariables => {
  if (typeof projectRoot !== 'string') projectRoot = process.cwd();

  let envVars: EnvironmentVariables = {};

  if (isAngularProject(projectRoot)) {
    envVars = loadAngularEnv(projectRoot, targetHtmlPath);
  } else if (isReactProject(projectRoot)) {
    envVars = loadReactEnv(projectRoot);
  } else {
    envVars = { ...loadReactEnv(projectRoot), ...loadAngularEnv(projectRoot, targetHtmlPath) };
  }

  return filterValidEnvironmentVariables(envVars);
};

// Re-export project detection
export { isAngularProject, isReactProject, detectProjectType };
