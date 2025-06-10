/**
 * @fileoverview Constants and default configurations for CSP injection
 */

import type { CSPConfig, CSPDirectives } from './types';
import { version as PACKAGE_VERSION } from '../package.json';

/**
 * Environment variable prefixes for different frameworks
 */
export const ENV_PREFIXES = {
  REACT: 'REACT_APP_',
  VITE: 'VITE_',
  ANGULAR: 'NG_',
} as const;

/**
 * Environment file patterns for different frameworks
 */
export const ENVIRONMENT_FILES = {
  REACT: [
    '.env.local',
    '.env.development.local',
    '.env.production.local',
    '.env.development',
    '.env.production',
    '.env',
  ],
  ANGULAR: {
    DEV: 'environment.ts',
    PROD: 'environment.prod.ts',
  },
} as const;

/**
 * HTML file search patterns for auto-detection
 */
export const HTML_SEARCH_PATHS = {
  DEV: [
    'projects/*/src/index.html', // Angular workspace projects
    'src/index.html', // Angular standalone & React
    'public/index.html', // React CRA & VITE public folder
    'index.html', // Fallback
  ],
  PROD: [
    'dist/*/index.html', // Angular workspace build output
    'dist/index.html', // Angular standalone & VITE build
    'build/index.html', // React CRA build
    'www/index.html', // Some build tools
    'public/index.html', // Fallback
    'index.html', // Last resort
  ],
} as const;

/**
 * CSP directive names
 */
export const CSP_DIRECTIVES = {
  DEFAULT_SRC: 'default-src',
  SCRIPT_SRC: 'script-src',
  STYLE_SRC: 'style-src',
  IMG_SRC: 'img-src',
  FONT_SRC: 'font-src',
  CONNECT_SRC: 'connect-src',
  WORKER_SRC: 'worker-src',
  MANIFEST_SRC: 'manifest-src',
  MEDIA_SRC: 'media-src',
  OBJECT_SRC: 'object-src',
  BASE_URI: 'base-uri',
  FORM_ACTION: 'form-action',
  FRAME_ANCESTORS: 'frame-ancestors',
  FRAME_SRC: 'frame-src',
  CHILD_SRC: 'child-src',
  SANDBOX: 'sandbox',
  SCRIPT_SRC_ATTR: 'script-src-attr',
  SCRIPT_SRC_ELEM: 'script-src-elem',
  STYLE_SRC_ATTR: 'style-src-attr',
  STYLE_SRC_ELEM: 'style-src-elem',
  REQUIRE_TRUSTED_TYPES_FOR: 'require-trusted-types-for',
  TRUSTED_TYPES: 'trusted-types',
  UPGRADE_INSECURE_REQUESTS: 'upgrade-insecure-requests',
  REPORT_URI: 'report-uri',
  REPORT_TO: 'report-to',
} as const;

/**
 * Common CSP values and keywords
 */
export const CSP_VALUES = {
  SELF: "'self'",
  UNSAFE_INLINE: "'unsafe-inline'",
  UNSAFE_EVAL: "'unsafe-eval'",
  STRICT_DYNAMIC: "'strict-dynamic'",
  NONE: "'none'",
  DATA: 'data:',
  BLOB: 'blob:',
  HTTPS: 'https:',
  HTTP: 'http:',
  WS: 'ws:',
  WSS: 'wss:',
} as const;

/**
 * Base CSP directives used in all configurations
 */
export const BASE_DIRECTIVES: CSPDirectives = {
  [CSP_DIRECTIVES.DEFAULT_SRC]: [CSP_VALUES.SELF],
  [CSP_DIRECTIVES.STYLE_SRC]: [CSP_VALUES.SELF, CSP_VALUES.UNSAFE_INLINE],
  [CSP_DIRECTIVES.IMG_SRC]: [CSP_VALUES.SELF, CSP_VALUES.DATA, CSP_VALUES.BLOB],
  [CSP_DIRECTIVES.FONT_SRC]: [CSP_VALUES.SELF, CSP_VALUES.DATA],
  [CSP_DIRECTIVES.CONNECT_SRC]: [CSP_VALUES.SELF],
  [CSP_DIRECTIVES.WORKER_SRC]: [CSP_VALUES.SELF, CSP_VALUES.BLOB],
  [CSP_DIRECTIVES.MANIFEST_SRC]: [CSP_VALUES.SELF],
  [CSP_DIRECTIVES.MEDIA_SRC]: [CSP_VALUES.SELF],
  [CSP_DIRECTIVES.OBJECT_SRC]: [CSP_VALUES.NONE],
  [CSP_DIRECTIVES.BASE_URI]: [CSP_VALUES.SELF],
  [CSP_DIRECTIVES.FORM_ACTION]: [CSP_VALUES.SELF],
  [CSP_DIRECTIVES.FRAME_ANCESTORS]: [CSP_VALUES.NONE],
};

/**
 * Default CSP configuration for development
 * Includes 'unsafe-inline' for scripts to support hot reloading
 */
export const DEFAULT_CSP_CONFIG: CSPConfig = {
  directives: {
    ...BASE_DIRECTIVES,
    [CSP_DIRECTIVES.SCRIPT_SRC]: [CSP_VALUES.SELF, CSP_VALUES.UNSAFE_INLINE],
  },
  useNonce: false,
  nonceLength: 16,
  reportOnly: false,
};

/**
 * Production CSP configuration
 * Stricter security without 'unsafe-inline' for scripts
 */
export const PRODUCTION_CSP_CONFIG: CSPConfig = {
  directives: {
    ...BASE_DIRECTIVES,
    [CSP_DIRECTIVES.SCRIPT_SRC]: [CSP_VALUES.SELF],
    [CSP_DIRECTIVES.UPGRADE_INSECURE_REQUESTS]: [],
  },
  useNonce: true,
  nonceLength: 24,
  reportOnly: false,
};

/**
 * Nonce length defaults (for backward compatibility)
 */
export const NONCE_DEFAULTS = {
  LENGTH: 16,
  PRODUCTION_LENGTH: 24,
} as const;

/**
 * Configuration file names to search for
 */
export const CONFIG_FILE_NAMES = [
  'csp.config.json',
  'csp.config.js',
  '.csprc',
  '.csprc.json',
  'csp.json',
] as const;

/**
 * Framework detection file patterns
 */
export const FRAMEWORK_DETECTION = {
  ANGULAR: ['angular.json', '.angular-cli.json', 'projects/*/src/environments/'],
  REACT_CRA: ['src/index.js', 'src/index.tsx', 'public/index.html'],
  REACT_VITE: ['vite.config.js', 'vite.config.ts', 'index.html'],
} as const;

/**
 * Default nonce length for CSP
 */
export const DEFAULT_NONCE_LENGTH = 16;

/**
 * Maximum nonce length for security
 */
export const MAX_NONCE_LENGTH = 64;

/**
 * Regular expressions for parsing
 */
export const REGEX_PATTERNS = {
  CSP_TAG: /<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=["']([^"']+)["']\s*\/?>/gi,
  CSP_REPORT_ONLY_TAG:
    /<meta\s+http-equiv=["']Content-Security-Policy-Report-Only["']\s+content=["']([^"']+)["']\s*\/?>/gi,
  ENV_VAR_PLACEHOLDER: /\{\{([^}]+)\}\}/g,
  NONCE_PLACEHOLDER: /{{CSP_NONCE}}/g,
  ENV_FILE_LINE: /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/,
  // Angular environment file parsing
  ENVIRONMENT_EXPORT: /export\s+const\s+environment\s*=\s*{([^}]+)}/s,
  ENVIRONMENT_PROPERTY: /(\w+):\s*(?:['"]([^'"]*?)['"]|(\w+|true|false)),?/g,
  TEMPLATE_VARIABLE: /\{\{(\w+)\}\}/g,
  // For backward compatibility
  CSP_META_TAG: /^.*<meta\s+[^>]*http-equiv\s*=\s*["']Content-Security-Policy.*$/gim,
  CSP_DETECTION: /^.*<meta\s+[^>]*http-equiv\s*=\s*["']Content-Security-Policy.*$/im,
  HEAD_TAG: /^.*<head[^>]*>.*$/im,
} as const;

/**
 * CLI help text
 */
export const CLI_HELP = `
arc-spa-csp - Enterprise Content Security Policy injector for Angular and React SPAs

USAGE:
  npx arc-spa-csp [options]

OPTIONS:
  --html <path>       Path to HTML file (auto-detected if not provided)
  --config <path>     Path to CSP configuration file  
  --dev               Development mode (allows unsafe-inline for scripts)
  --dry-run           Show what would be done without making changes
  --verbose           Show detailed output
  --help              Show this help message
  --version           Show version information

EXAMPLES:
  # Auto-detect and inject CSP
  npx arc-spa-csp
  
  # Development mode with auto-detection
  npx arc-spa-csp --dev
  
  # Specify HTML file and config
  npx arc-spa-csp --html dist/index.html --config csp.config.json
  
  # Dry run to see what would happen
  npx arc-spa-csp --dry-run
  
  # Angular workspace project
  npx arc-spa-csp --html projects/admin-portal/src/index.html --dev
  
  # React VITE project
  npx arc-spa-csp --html index.html --dev

SUPPORTED PROJECTS:
  ✓ Angular (standalone & workspace)
  ✓ React (Create React App)  
  ✓ React (VITE)
  ✓ Environment variables: REACT_APP_*, VITE_*, NG_*

For more information, visit: https://github.com/sourcefuse/arc-spa-csp
`;

/**
 * Version information
 */
export const VERSION = PACKAGE_VERSION;
