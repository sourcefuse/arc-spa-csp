import * as fs from 'fs';
import * as path from 'path';
import { CSPConfig, EnvironmentVariables, Logger } from '../types/csp';
import { REGEX_PATTERNS } from '../constants';

/**
 * Default logger implementation
 */
const defaultLogger: Logger = {
  warn: (message: string): void => {
    // eslint-disable-next-line no-console
    console.warn(message);
  },
};

/**
 * Safe JSON parsing to prevent prototype pollution
 */
export function safeJsonParse<T>(jsonString: string): T | null {
  try {
    const parsed = JSON.parse(jsonString);

    // Basic protection against prototype pollution
    if (parsed && typeof parsed === 'object') {
      // Use Object.defineProperty instead of delete for security
      Object.defineProperty(parsed, '__proto__', { value: null, configurable: false });
      delete parsed.constructor;
      delete parsed.prototype;
    }

    return parsed as T;
  } catch {
    return null;
  }
}

/**
 * Resolve template variables in a string
 */
export function resolveTemplateVariables(template: string, envVars: EnvironmentVariables): string {
  // Use REGEX_PATTERNS constant for consistency and prevent ReDoS attacks
  const templateRegex = REGEX_PATTERNS.TEMPLATE_VARIABLE;
  return template.replace(templateRegex, (match, varName: string) => {
    const replacement = envVars[varName];
    return replacement ?? match;
  });
}

/**
 * Load configuration from file or use defaults with environment variable resolution
 */
export function loadConfig(
  baseConfigs: { DEFAULT: CSPConfig; PRODUCTION: CSPConfig },
  configPath?: string,
  envVars?: EnvironmentVariables
): CSPConfig {
  const resolvedEnvVars = envVars ?? {};

  // Try to load from config file first
  const configFromFile = loadConfigFromFile(baseConfigs, resolvedEnvVars, configPath);
  if (configFromFile) {
    return configFromFile;
  }

  // Create enhanced defaults if environment variables are available
  const enhancedConfig = createEnhancedDefaultConfig(baseConfigs, resolvedEnvVars);
  if (enhancedConfig) {
    return enhancedConfig;
  }

  // Use production config if NODE_ENV is production
  return getDefaultConfigForEnvironment(baseConfigs, resolvedEnvVars);
}

/**
 * Get default configuration based on environment
 */
function getDefaultConfigForEnvironment(
  baseConfigs: { DEFAULT: CSPConfig; PRODUCTION: CSPConfig },
  envVars: EnvironmentVariables
): CSPConfig {
  return envVars['NODE_ENV'] === 'production' ? baseConfigs.PRODUCTION : baseConfigs.DEFAULT;
}

/**
 * Load configuration from file
 */
function loadConfigFromFile(
  baseConfigs: { DEFAULT: CSPConfig; PRODUCTION: CSPConfig },
  envVars: EnvironmentVariables,
  configPath?: string
): CSPConfig | null {
  const configContent = readConfigFile(configPath);
  if (!configContent.content || !configContent.filePath) {
    return null;
  }

  const resolvedContent = resolveTemplateVariables(configContent.content, envVars);
  const userConfig = safeJsonParse<Partial<CSPConfig>>(resolvedContent);

  if (!userConfig) {
    defaultLogger.warn(`Warning: Invalid config file ${configContent.filePath}, using defaults`);
    return null;
  }

  const baseConfig = getDefaultConfigForEnvironment(baseConfigs, envVars);

  return {
    ...baseConfig,
    ...userConfig,
    directives: {
      ...baseConfig.directives,
      ...userConfig.directives,
    },
  };
}

/**
 * Read configuration file content
 */
function readConfigFile(configPath?: string): {
  content: string | null;
  filePath: string | null;
} {
  // Try specified config file first
  const specifiedConfigResult = tryReadSpecifiedConfig(configPath);
  if (specifiedConfigResult) {
    return specifiedConfigResult;
  }

  // Try default config file
  return tryReadDefaultConfig();
}

/**
 * Try to read specified config file
 */
function tryReadSpecifiedConfig(configPath?: string): { content: string; filePath: string } | null {
  if (!configPath || !fs.existsSync(configPath)) {
    return null;
  }

  try {
    return {
      content: fs.readFileSync(configPath, 'utf-8'),
      filePath: configPath,
    };
  } catch {
    defaultLogger.warn(`Warning: Could not read config file ${configPath}, using defaults`);
    return null;
  }
}

/**
 * Try to read default config file
 */
function tryReadDefaultConfig(): { content: string | null; filePath: string | null } {
  const defaultPath = path.resolve(process.cwd(), 'csp.config.json');
  if (!fs.existsSync(defaultPath)) {
    return { content: null, filePath: null };
  }

  try {
    return {
      content: fs.readFileSync(defaultPath, 'utf-8'),
      filePath: defaultPath,
    };
  } catch {
    defaultLogger.warn('Warning: Could not read csp.config.json, using defaults');
    return { content: null, filePath: null };
  }
}

/**
 * Create enhanced default configuration with all available environment variables
 */
function createEnhancedDefaultConfig(
  baseConfigs: { DEFAULT: CSPConfig; PRODUCTION: CSPConfig },
  envVars: EnvironmentVariables
): CSPConfig | null {
  const frameworkVars = getFrameworkEnvironmentVariables(envVars);

  if (frameworkVars.length === 0) {
    return null;
  }

  const baseConfig = getDefaultConfigForEnvironment(baseConfigs, envVars);
  return enhanceConfigWithVariables(baseConfig, frameworkVars);
}

/**
 * Get framework-specific environment variables
 */
function getFrameworkEnvironmentVariables(envVars: EnvironmentVariables): string[] {
  const ENV_PREFIXES = {
    REACT: 'REACT_APP_',
    VITE: 'VITE_',
    ANGULAR: 'NG_',
  } as const;

  return Object.keys(envVars).filter(
    key =>
      key.startsWith(ENV_PREFIXES.REACT) ||
      key.startsWith(ENV_PREFIXES.VITE) ||
      key.startsWith(ENV_PREFIXES.ANGULAR)
  );
}

/**
 * Enhance configuration with environment variable placeholders
 */
function enhanceConfigWithVariables(baseConfig: CSPConfig, variables: string[]): CSPConfig {
  const placeholders = variables.map(variable => `{{${variable}}}`);
  const enhancedDirectives: Record<string, string[]> = { ...baseConfig.directives };

  const CSP_DIRECTIVES = {
    CONNECT_SRC: 'connect-src',
    SCRIPT_SRC: 'script-src',
    IMG_SRC: 'img-src',
  } as const;

  // Add placeholders to common directives that typically need environment variables
  const directivesToEnhance = [
    CSP_DIRECTIVES.CONNECT_SRC,
    CSP_DIRECTIVES.SCRIPT_SRC,
    CSP_DIRECTIVES.IMG_SRC,
  ];

  directivesToEnhance.forEach(directive => {
    const existingValues = enhancedDirectives[directive];
    if (existingValues && Array.isArray(existingValues)) {
      enhancedDirectives[directive] = [...existingValues, ...placeholders];
    }
  });

  return {
    ...baseConfig,
    directives: enhancedDirectives,
  };
}

/**
 * Merge custom config with defaults
 */
export function mergeConfigWithDefaults(
  defaultConfig: CSPConfig,
  config: Partial<CSPConfig>
): CSPConfig {
  return {
    ...defaultConfig,
    ...config,
    directives: {
      ...defaultConfig.directives,
      ...config.directives,
    },
  };
}
