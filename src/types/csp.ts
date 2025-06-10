/**
 * Environment variables interface
 */
export interface EnvironmentVariables {
  [key: string]: string | undefined;
}

/**
 * CSP configuration interface
 */
export interface CSPConfig {
  /** CSP directives and their allowed values */
  directives: Record<string, string[]>;
  /** Whether to use nonce for inline scripts/styles */
  useNonce?: boolean;
  /** Length of generated nonce */
  nonceLength?: number;
  /** Whether to use report-only mode */
  reportOnly?: boolean;
}

/**
 * CSP injection result
 */
export interface CSPInjectionResult {
  /** Path to the HTML file that was modified */
  htmlPath: string;
  /** Generated nonce (if applicable) */
  nonce?: string | undefined;
  /** Number of existing CSP tags that were replaced */
  replacedTags: number;
  /** Generated CSP string */
  cspString: string;
  /** Resolved environment variables used */
  envVars?: EnvironmentVariables;
}

/**
 * HTML detection result
 */
export interface HTMLDetectionResult {
  /** Path to the found HTML file */
  path: string;
  /** Directory where HTML was found */
  buildDir: string;
  /** Whether HTML file has existing CSP tags */
  hasExistingCSP: boolean;
}

/**
 * Injection options interface
 */
export interface InjectOptions {
  htmlPath?: string;
  configPath?: string;
  devMode?: boolean;
  config?: Partial<CSPConfig>;
  envVars?: EnvironmentVariables;
}

/**
 * Logger interface for handling warnings and errors
 */
export interface Logger {
  warn(message: string): void;
}
