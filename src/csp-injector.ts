import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  EnvironmentVariables,
  CSPConfig,
  CSPInjectionResult,
  HTMLDetectionResult,
  InjectOptions,
} from './types/csp';
import {
  loadConfig,
  resolveTemplateVariables,
  mergeConfigWithDefaults,
} from './utils/config-loader';
import { detectHTML, processHTMLContent, detectAngularWorkspaceRoot } from './utils/html-detector';
import { setupEnvironmentForMode, restoreEnvironment } from './utils/node-env-manager';

// Re-export types for backward compatibility and CLI usage
export type {
  EnvironmentVariables,
  CSPConfig,
  CSPInjectionResult,
  HTMLDetectionResult,
  InjectOptions,
} from './types/csp';

// Constants for better maintainability
const CSP_DIRECTIVES = {
  DEFAULT_SRC: 'default-src',
  SCRIPT_SRC: 'script-src',
  STYLE_SRC: 'style-src',
  IMG_SRC: 'img-src',
  FONT_SRC: 'font-src',
  CONNECT_SRC: 'connect-src',
  WORKER_SRC: 'worker-src',
  MANIFEST_SRC: 'manifest-src',
} as const;

const CSP_VALUES = {
  SELF: "'self'",
  UNSAFE_INLINE: "'unsafe-inline'",
  DATA: 'data:',
  BLOB: 'blob:',
} as const;

/**
 * Base CSP directives used in both dev and production configs
 */
const BASE_DIRECTIVES: Record<string, string[]> = {
  [CSP_DIRECTIVES.DEFAULT_SRC]: [CSP_VALUES.SELF],
  [CSP_DIRECTIVES.STYLE_SRC]: [CSP_VALUES.SELF, CSP_VALUES.UNSAFE_INLINE], // Angular needs this
  [CSP_DIRECTIVES.IMG_SRC]: [CSP_VALUES.SELF, CSP_VALUES.DATA, CSP_VALUES.BLOB],
  [CSP_DIRECTIVES.FONT_SRC]: [CSP_VALUES.SELF, CSP_VALUES.DATA],
  [CSP_DIRECTIVES.CONNECT_SRC]: [CSP_VALUES.SELF],
  [CSP_DIRECTIVES.WORKER_SRC]: [CSP_VALUES.SELF, CSP_VALUES.BLOB],
  [CSP_DIRECTIVES.MANIFEST_SRC]: [CSP_VALUES.SELF],
};

/**
 * Simple CSP Injector for React and Angular applications
 */
export class CSPInjector {
  /**
   * Default CSP configuration that works for most React/Angular apps
   */
  public static readonly DEFAULT_CONFIG: CSPConfig = {
    directives: {
      ...BASE_DIRECTIVES,
      [CSP_DIRECTIVES.SCRIPT_SRC]: [CSP_VALUES.SELF, CSP_VALUES.UNSAFE_INLINE],
    },
    useNonce: false,
    nonceLength: 16,
    reportOnly: false,
  };

  /**
   * Stricter production config
   */
  public static readonly PRODUCTION_CONFIG: CSPConfig = {
    directives: {
      ...BASE_DIRECTIVES,
      [CSP_DIRECTIVES.SCRIPT_SRC]: [CSP_VALUES.SELF], // No unsafe-inline in production
    },
    useNonce: true,
    nonceLength: 24,
    reportOnly: false,
  };

  private readonly config: CSPConfig;
  private readonly envVars: EnvironmentVariables;

  constructor(config?: Partial<CSPConfig>, envVars?: EnvironmentVariables) {
    this.config = this.mergeConfigs(CSPInjector.DEFAULT_CONFIG, config);
    this.envVars = envVars ?? {};
  }

  /**
   * Merge user config with base config
   */
  private mergeConfigs(baseConfig: CSPConfig, userConfig?: Partial<CSPConfig>): CSPConfig {
    return {
      ...baseConfig,
      ...userConfig,
      directives: {
        ...baseConfig.directives,
        ...userConfig?.directives,
      },
    };
  }

  /**
   * Load environment variables with enhanced Angular workspace support
   */
  public static loadEnvironmentVariables(
    projectRoot: string = process.cwd()
  ): EnvironmentVariables {
    const envVars: EnvironmentVariables = {};

    // Always include Node.js environment variables
    Object.assign(envVars, process.env);

    // Use the new refactored environment loading system
    const { loadEnvironmentVariables: loadFrameworkEnv } = require('./utils/environment');
    const frameworkEnvVars = loadFrameworkEnv(projectRoot) as EnvironmentVariables;

    // Merge framework environment variables, filtering out empty strings
    for (const [key, value] of Object.entries(frameworkEnvVars)) {
      if (value && value !== '' && value !== 'undefined' && value !== 'null') {
        envVars[key] = value as string;
      }
    }

    return envVars;
  }

  /**
   * Load configuration from file or use defaults with environment variable resolution
   */
  public static loadConfig(configPath?: string, envVars?: EnvironmentVariables): CSPConfig {
    const resolvedEnvVars = envVars ?? CSPInjector.loadEnvironmentVariables();
    const baseConfigs = {
      DEFAULT: CSPInjector.DEFAULT_CONFIG,
      PRODUCTION: CSPInjector.PRODUCTION_CONFIG,
    };

    return loadConfig(baseConfigs, configPath, resolvedEnvVars);
  }

  /**
   * Find HTML file in common locations
   */
  public static detectHTML(devMode = false): HTMLDetectionResult | null {
    return detectHTML(devMode);
  }

  /**
   * Build CSP string from directives with environment variable resolution
   */
  public buildCSP(nonce?: string): string {
    return Object.entries(this.config.directives)
      .map(([directive, values]) => {
        const processedValues = values
          .map((value: string) => this.processCSPValue(value, nonce))
          .filter((value: string) => value && value.trim() !== ''); // Filter out empty/whitespace values

        return `${directive} ${processedValues.join(' ')}`;
      })
      .join('; ');
  }

  /**
   * Process a single CSP value
   */
  private processCSPValue(value: string, nonce?: string): string {
    // Handle nonce template
    if (nonce && value === "'nonce-{{nonce}}'") {
      return `'nonce-${nonce}'`;
    }

    // Resolve environment variables
    return resolveTemplateVariables(value, this.envVars);
  }

  /**
   * Generate cryptographically secure nonce
   */
  public generateNonce(): string {
    return crypto.randomBytes(this.config.nonceLength ?? 16).toString('base64');
  }

  /**
   * Inject CSP meta tag into HTML
   */
  public injectCSP(htmlPath: string, cspString?: string): CSPInjectionResult {
    try {
      const html = fs.readFileSync(htmlPath, 'utf-8');
      const nonce = this.config.useNonce ? this.generateNonce() : undefined;
      const csp = cspString ?? this.buildCSP(nonce);

      const { modifiedHtml, replacedTags } = processHTMLContent(
        html,
        csp,
        this.config.reportOnly ?? false
      );

      fs.writeFileSync(htmlPath, modifiedHtml, 'utf-8');

      return {
        htmlPath,
        replacedTags,
        cspString: csp,
        nonce,
        envVars: this.envVars,
      };
    } catch (error) {
      throw new Error(
        `Failed to inject CSP: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Simple static method to inject CSP with minimal configuration and automatic environment resolution
   */
  public static inject(options: InjectOptions = {}): CSPInjectionResult {
    const { projectRoot, htmlPath } = CSPInjector.resolveProjectPaths(options);

    return CSPInjector.executeInjectionWithEnvironment(options, projectRoot, htmlPath);
  }

  /**
   * Resolve project root and HTML path
   */
  private static resolveProjectPaths(options: InjectOptions): {
    projectRoot: string;
    htmlPath: string;
  } {
    // Determine project root directory from config path if provided
    let projectRoot = process.cwd();
    if (options.configPath) {
      projectRoot = path.dirname(path.resolve(process.cwd(), options.configPath));
    }

    // Find HTML file first (either explicit or auto-detected)
    let htmlPath: string;
    if (options.htmlPath) {
      const resolvedPath = path.resolve(process.cwd(), options.htmlPath);
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`HTML file not found: ${resolvedPath}`);
      }
      htmlPath = resolvedPath;
    } else {
      const detectedHTML = CSPInjector.detectHTML(options.devMode);
      if (!detectedHTML) {
        throw new Error(
          'HTML file not found. Please specify htmlPath or ensure index.html exists in common locations.'
        );
      }
      htmlPath = detectedHTML.path;
    }

    // Apply workspace detection logic for Angular projects
    if (!options.configPath) {
      projectRoot = detectAngularWorkspaceRoot(projectRoot, htmlPath);
    }

    return { projectRoot, htmlPath };
  }

  /**
   * Execute injection with proper environment setup
   */
  private static executeInjectionWithEnvironment(
    options: InjectOptions,
    projectRoot: string,
    htmlPath: string
  ): CSPInjectionResult {
    const originalNodeEnv = process.env['NODE_ENV'];
    let shouldRestoreNodeEnv = false;

    try {
      // Set NODE_ENV based on devMode flag
      shouldRestoreNodeEnv = setupEnvironmentForMode(options.devMode);

      // Load environment variables and configuration
      const envVars = options.envVars ?? CSPInjector.loadEnvironmentVariables(projectRoot);

      const config = options.config
        ? mergeConfigWithDefaults(CSPInjector.DEFAULT_CONFIG, options.config)
        : CSPInjector.loadConfig(options.configPath, envVars);

      const injector = new CSPInjector(config, envVars);
      return injector.injectCSP(htmlPath);
    } finally {
      restoreEnvironment(shouldRestoreNodeEnv, originalNodeEnv);
    }
  }
}
