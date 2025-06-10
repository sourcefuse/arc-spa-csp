/**
 * @fileoverview Main entry point for the CSP injector package
 * @author SourceFuse
 * @license MIT
 */

// Main exports
export { CSPInjector } from './csp-injector';

// Type exports
export type {
  CSPConfig,
  CSPInjectionResult,
  HTMLDetectionResult,
  EnvironmentVariables,
  InjectOptions,
  CSPDirectives,
  ProjectType,
} from './types';

// Constant exports
export {
  ENV_PREFIXES,
  HTML_SEARCH_PATHS,
  CSP_DIRECTIVES,
  CSP_VALUES,
  DEFAULT_CSP_CONFIG,
  PRODUCTION_CSP_CONFIG,
  BASE_DIRECTIVES,
  NONCE_DEFAULTS,
  REGEX_PATTERNS,
  VERSION,
} from './constants';

// Utility exports
export {
  resolveTemplateVariables,
  loadEnvironmentVariables,
  loadReactEnv,
  loadAngularEnv,
  parseEnvFile,
  parseAngularEnvFile,
  isReactProject,
  isAngularProject,
  getFrameworkEnvironmentVariables,
  detectProjectType,
} from './utils/environment';

// Re-export for convenience (import here to avoid circular dependency)
import { CSPInjector } from './csp-injector';

/**
 * Convenience injection function
 */
export const inject = CSPInjector.inject;

/**
 * Default export for backward compatibility
 */
export default CSPInjector;
