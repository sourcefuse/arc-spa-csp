/**
 * @fileoverview Type definitions for the CSP injector package
 */

/**
 * Environment variables map
 */
export interface EnvironmentVariables {
  readonly [key: string]: string | undefined;
}

/**
 * CSP directive names and their allowed values
 */
export interface CSPDirectives {
  readonly 'default-src'?: readonly string[];
  readonly 'script-src'?: readonly string[];
  readonly 'style-src'?: readonly string[];
  readonly 'img-src'?: readonly string[];
  readonly 'font-src'?: readonly string[];
  readonly 'connect-src'?: readonly string[];
  readonly 'worker-src'?: readonly string[];
  readonly 'manifest-src'?: readonly string[];
  readonly 'media-src'?: readonly string[];
  readonly 'object-src'?: readonly string[];
  readonly 'base-uri'?: readonly string[];
  readonly 'form-action'?: readonly string[];
  readonly 'frame-ancestors'?: readonly string[];
  readonly 'frame-src'?: readonly string[];
  readonly 'child-src'?: readonly string[];
  readonly sandbox?: readonly string[];
  readonly 'script-src-attr'?: readonly string[];
  readonly 'script-src-elem'?: readonly string[];
  readonly 'style-src-attr'?: readonly string[];
  readonly 'style-src-elem'?: readonly string[];
  readonly 'require-trusted-types-for'?: readonly string[];
  readonly 'trusted-types'?: readonly string[];
  readonly 'upgrade-insecure-requests'?: readonly string[];
  readonly 'report-uri'?: readonly string[];
  readonly 'report-to'?: readonly string[];
  readonly [directive: string]: readonly string[] | undefined;
}

/**
 * CSP configuration interface
 */
export interface CSPConfig {
  /** CSP directives and their allowed values */
  readonly directives: CSPDirectives;
  /** Whether to use nonce for inline scripts/styles */
  readonly useNonce?: boolean;
  /** Length of generated nonce */
  readonly nonceLength?: number;
  /** Whether to use report-only mode */
  readonly reportOnly?: boolean;
  /** Report URI for CSP violations */
  readonly reportUri?: string;
}

/**
 * CSP injection result
 */
export interface CSPInjectionResult {
  /** Path to the HTML file that was modified */
  readonly htmlPath: string;
  /** Generated nonce (if applicable) */
  readonly nonce?: string;
  /** Number of existing CSP tags that were replaced */
  readonly replacedTags: number;
  /** Generated CSP string */
  readonly cspString: string;
  /** Resolved environment variables used */
  readonly envVars?: EnvironmentVariables;
}

/**
 * HTML detection result
 */
export interface HTMLDetectionResult {
  /** Path to the found HTML file */
  readonly path: string;
  /** Directory where HTML was found */
  readonly buildDir: string;
  /** Whether HTML file has existing CSP tags */
  readonly hasExistingCSP: boolean;
  /** Type of project detected */
  readonly projectType?: ProjectType;
}

/**
 * Project type enumeration
 */
export type ProjectType =
  | 'react-cra'
  | 'react-vite'
  | 'angular-standalone'
  | 'angular-workspace'
  | 'unknown';

/**
 * Framework detection result
 */
export interface FrameworkDetectionResult {
  readonly type: ProjectType;
  readonly configFiles: readonly string[];
  readonly packageJson?: Record<string, unknown>;
}

/**
 * Options for injection operation
 */
export interface InjectOptions {
  /** Path to HTML file (optional, will auto-detect if not provided) */
  readonly htmlPath?: string;
  /** Path to configuration file */
  readonly configPath?: string;
  /** Whether running in development mode */
  readonly devMode?: boolean;
  /** CSP configuration (overrides config file) */
  readonly config?: Partial<CSPConfig>;
  /** Environment variables (overrides auto-detection) */
  readonly envVars?: EnvironmentVariables;
  /** Project root directory */
  readonly projectRoot?: string;
  /** Whether to perform dry run (no file modifications) */
  readonly dryRun?: boolean;
  /** Whether to show verbose output */
  readonly verbose?: boolean;
}

/**
 * Environment loading result
 */
export interface EnvironmentLoadResult {
  readonly variables: EnvironmentVariables;
  readonly sources: readonly string[];
  readonly projectType: ProjectType;
}

/**
 * Configuration loading result
 */
export interface ConfigLoadResult {
  readonly config: CSPConfig;
  readonly source: string;
  readonly isDefault: boolean;
}

/**
 * File operation result
 */
export interface FileOperationResult {
  readonly success: boolean;
  readonly path: string;
  readonly message?: string;
  readonly error?: Error;
}

/**
 * Validation result
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Log level enumeration
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Logger interface
 */
export interface Logger {
  error(message: string, ...args: readonly unknown[]): void;
  warn(message: string, ...args: readonly unknown[]): void;
  info(message: string, ...args: readonly unknown[]): void;
  debug(message: string, ...args: readonly unknown[]): void;
  setLevel(level: LogLevel): void;
}

/**
 * CLI command arguments
 */
export interface CLIArguments {
  readonly _: readonly string[];
  readonly html?: string;
  readonly config?: string;
  readonly dev?: boolean;
  readonly 'dry-run'?: boolean;
  readonly verbose?: boolean;
  readonly help?: boolean;
  readonly version?: boolean;
  readonly [key: string]: unknown;
}
