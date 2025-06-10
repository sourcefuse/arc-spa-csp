/**
 * @fileoverview Project type detection utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ProjectType } from '../types';

/**
 * Logger interface for debug output
 */
interface Logger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * Debug logger with configurable levels
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

/**
 * Detect if project is Angular
 * @param projectRoot - Root directory of the project
 * @returns Whether the project is Angular
 */
export const isAngularProject = (projectRoot: string): boolean => {
  if (typeof projectRoot !== 'string') {
    logger.warn('isAngularProject: projectRoot must be a string');
    return false;
  }

  const angularFiles = ['angular.json', '.angular-cli.json'];

  const hasAngularConfig = angularFiles.some(file => {
    const filePath = path.join(projectRoot, file);
    return fs.existsSync(filePath);
  });

  if (hasAngularConfig) {
    logger.log(`isAngularProject: Found Angular config files in ${projectRoot}`);
    return true;
  }

  const hasAngularEnvFiles = hasAngularEnvironmentFiles(projectRoot);
  if (hasAngularEnvFiles) {
    logger.log(`isAngularProject: Found Angular environment files in ${projectRoot}`);
  }

  return hasAngularEnvFiles;
};

/**
 * Detect if project is React
 * @param projectRoot - Root directory of the project
 * @returns Whether the project is React
 */
export const isReactProject = (projectRoot: string): boolean => {
  if (typeof projectRoot !== 'string') {
    logger.warn('isReactProject: projectRoot must be a string');
    return false;
  }

  try {
    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      logger.log(`isReactProject: No package.json found in ${projectRoot}`);
      return false;
    }

    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const isReact = deps['react'] !== undefined || deps['@types/react'] !== undefined;

    if (isReact) {
      logger.log(`isReactProject: Found React dependencies in ${projectRoot}`);
    }

    return isReact;
  } catch (error) {
    logger.warn(
      `isReactProject: Error reading package.json in ${projectRoot}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return false;
  }
};

/**
 * Check if Angular environment files exist
 * @param projectRoot - Root directory to search
 * @returns Whether Angular environment files exist
 */
const hasAngularEnvironmentFiles = (projectRoot: string): boolean => {
  const envPaths = [
    path.join(projectRoot, 'src', 'environments'),
    path.join(projectRoot, 'projects'),
  ];

  return envPaths.some(envPath => {
    try {
      return fs.existsSync(envPath);
    } catch (error) {
      logger.warn(
        `hasAngularEnvironmentFiles: Error checking path ${envPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return false;
    }
  });
};

/**
 * Check for VITE project type
 * @param projectRoot - Root directory to check
 * @returns Whether the project is VITE
 */
const isViteProject = (projectRoot: string): boolean => {
  const viteFiles = ['vite.config.js', 'vite.config.ts'];
  return viteFiles.some(file => fs.existsSync(path.join(projectRoot, file)));
};

/**
 * Detect Angular project type from angular.json
 * @param projectRoot - Root directory to check
 * @returns Angular project type or null
 */
const detectAngularType = (projectRoot: string): ProjectType | null => {
  const angularJsonPath = path.join(projectRoot, 'angular.json');
  if (!fs.existsSync(angularJsonPath)) {
    return null;
  }

  try {
    const angularJsonContent = fs.readFileSync(angularJsonPath, 'utf8');
    const angularJson = JSON.parse(angularJsonContent) as {
      projects?: Record<string, unknown>;
    };

    if (angularJson.projects && Object.keys(angularJson.projects).length > 1) {
      logger.log('detectAngularType: Detected Angular workspace');
      return 'angular-workspace';
    }
    logger.log('detectAngularType: Detected Angular standalone');
    return 'angular-standalone';
  } catch (error) {
    logger.warn(
      `detectAngularType: Error parsing angular.json: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return 'angular-standalone';
  }
};

/**
 * Auto-detect project type
 * @param projectRoot - Root directory of the project (defaults to current working directory)
 * @returns Detected project type
 */
export const detectProjectType = (projectRoot: string = process.cwd()): ProjectType => {
  if (typeof projectRoot !== 'string') {
    logger.warn('detectProjectType: projectRoot must be a string, using current directory');
    projectRoot = process.cwd();
  }

  logger.log(`detectProjectType: Detecting project type in ${projectRoot}`);

  // Check for VITE
  if (isViteProject(projectRoot)) {
    logger.log('detectProjectType: Detected VITE project');
    return 'react-vite';
  }

  // Check for Angular workspace/standalone
  const angularType = detectAngularType(projectRoot);
  if (angularType) {
    return angularType;
  }

  // Check for Angular standalone
  if (isAngularProject(projectRoot)) {
    logger.log('detectProjectType: Detected Angular standalone project');
    return 'angular-standalone';
  }

  // Check for React CRA
  if (isReactProject(projectRoot)) {
    logger.log('detectProjectType: Detected React CRA project');
    return 'react-cra';
  }

  logger.log('detectProjectType: Could not detect specific project type');
  return 'unknown';
};
