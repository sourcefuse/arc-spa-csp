#!/usr/bin/env node

import {
  CSPInjector,
  CSPInjectionResult,
  HTMLDetectionResult,
  CSPConfig,
  EnvironmentVariables,
} from './csp-injector';
import fs from 'fs';
import path from 'path';
import { version as PACKAGE_VERSION } from '../package.json';

// Constants for better maintainability
const CLI_VERSION = PACKAGE_VERSION;

const CLI_OPTIONS = {
  HTML: ['html', 'h'] as string[],
  CONFIG: ['config', 'c'] as string[],
  DEV: ['dev', 'd'] as string[],
  DRY_RUN: 'dry-run',
  INIT: 'init',
  INTERACTIVE: ['interactive', 'i'] as string[],
  HELP: 'help',
  VERSION: ['version', 'v'] as string[],
} as const;

const MESSAGES = {
  SUCCESS: '✅ CSP injected successfully!',
  ERROR_PREFIX: '❌ Error:',
  DRY_RUN_PREFIX: '🧪 Dry run mode - showing what would be done:\n',
  READY: '✅ Ready to inject CSP. Remove --dry-run to proceed.',
} as const;

const EMOJI = {
  FILE: '📄',
  BUILD: '🔍',
  CONFIG: '⚙️',
  ENV: '🌍',
  LINK: '🔗',
  SETTINGS: '🔧',
  DICE: '🎲',
  REPLACE: '🔄',
  QUESTION: '❓',
  FRAMEWORK: '🚀',
  SECURITY: '🔐',
} as const;

/**
 * Framework configuration options
 */
interface FrameworkChoice {
  name: string;
  value: string;
  envPrefix: string;
  description: string;
}

/**
 * Interactive configuration options
 */
interface InteractiveConfig {
  framework: string;
  useNonce: boolean;
  reportOnly: boolean;
  includeEnvVars: boolean;
  configType: 'development' | 'production' | 'custom';
}

/**
 * Parsed CLI arguments
 */
interface ParsedArgs {
  options: CliOptions;
  positional: string[];
}

/**
 * CLI options type
 */
type CliOptions = Record<string, string | boolean | undefined>;

/**
 * Injection options interface
 */
interface InjectOptions {
  htmlPath?: string;
  configPath?: string;
  devMode?: boolean;
}

/**
 * Simplified CLI for CSP injection
 */
export class CLI {
  /**
   * Parse command line arguments
   */
  public static parseArguments(args: string[]): ParsedArgs {
    const result: ParsedArgs = {
      options: {},
      positional: [],
    };

    let i = 0;
    while (i < args.length) {
      const arg = args[i];
      if (!arg) {
        i++;
        continue; // Skip if arg is undefined
      }

      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        const value = CLI.getArgumentValue(args, i);
        result.options[key] = value ?? true;
        i += CLI.hasValue(args, i) ? 2 : 1; // Skip both current arg and its value if present
      } else if (arg.startsWith('-') && arg.length > 1) {
        const key = arg.slice(1);
        const value = CLI.getArgumentValue(args, i);
        result.options[key] = value ?? true;
        i += CLI.hasValue(args, i) ? 2 : 1; // Skip both current arg and its value if present
      } else {
        result.positional.push(arg);
        i++;
      }
    }

    return result;
  }

  /**
   * Get argument value if it exists
   */
  private static getArgumentValue(args: string[], index: number): string | null {
    const nextArg = args[index + 1];
    return nextArg && !nextArg.startsWith('-') ? nextArg : null;
  }

  /**
   * Check if argument has a value
   */
  private static hasValue(args: string[], index: number): boolean {
    return !!CLI.getArgumentValue(args, index);
  }

  /**
   * Show help information
   */
  public static printHelp(): void {
    console.log(`
🛡️  @arc/spa-csp v${CLI_VERSION} - CSP injection for React & Angular

USAGE:
  arc-spa-csp [options]
  inject-csp [options]

COMMANDS:
  init                         Create default csp.config.json file
  init --interactive, -i       Interactive configuration wizard
  (no command)                 Inject CSP into HTML file

OPTIONS:
  --html, -h <path>     Path to HTML file (auto-detected if not specified)
  --config, -c <path>   Path to config file (uses defaults if not specified)
  --dev, -d            Development mode (injects into source files)
  --dry-run            Show what would be done without making changes
  --interactive, -i    Interactive mode for init command
  --help               Show this help
  --version, -v        Show version

EXAMPLES:
  arc-spa-csp                              # Auto-detect and inject CSP
  arc-spa-csp --dev                        # Development mode (no build required)
  arc-spa-csp --html build/index.html      # Specific HTML file
  arc-spa-csp --config custom.json         # Custom config
  arc-spa-csp --dry-run                    # Preview changes
  arc-spa-csp init                         # Create default config file
  arc-spa-csp init --interactive           # Interactive setup wizard

DEVELOPMENT MODE (--dev):
  🚀 Inject CSP into source files without requiring a build:
     • React CRA: Modifies public/index.html (used by dev server)
     • React Vite: Modifies index.html (used by dev server)
     • Angular: Modifies src/index.html (used by ng serve)
     • Angular Workspace: Supports projects/*/src/index.html

AUTO-DETECTION:
  🔍 Development Mode (--dev):
     • src/index.html (Angular)
     • projects/*/src/index.html (Angular workspace)
     • public/index.html (React CRA)
     • index.html (Vite)

  🔍 Production Mode (default):
     • build/index.html (React CRA build)
     • dist/index.html (Vite, Angular build)
     • dist/*/index.html (Angular build)

CONFIGURATION:
  Create csp.config.json with custom CSP directives, or use built-in defaults.
  Environment variables ({{REACT_APP_*}}, {{VITE_*}}, {{NG_*}}) are automatically resolved.

Documentation: https://github.com/sourcefuse/arc-spa-csp
`);
  }

  /**
   * Build injection options from CLI arguments
   */
  private static buildInjectOptions(options: CliOptions): InjectOptions {
    const result: InjectOptions = {};

    const htmlPath = CLI.getOptionValue(options, CLI_OPTIONS.HTML);
    if (typeof htmlPath === 'string') {
      result.htmlPath = htmlPath;
    }

    const configPath = CLI.getOptionValue(options, CLI_OPTIONS.CONFIG);
    if (typeof configPath === 'string') {
      result.configPath = configPath;
    }

    const devMode = CLI.getOptionValue(options, CLI_OPTIONS.DEV);
    if (typeof devMode === 'boolean') {
      result.devMode = devMode;
    }

    return result;
  }

  /**
   * Get option value by checking multiple possible keys
   */
  private static getOptionValue(
    options: CliOptions,
    keys: string | string[]
  ): string | boolean | undefined {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    return keyArray.find(key => options[key] !== undefined)
      ? options[keyArray.find(key => options[key] !== undefined)!]
      : undefined;
  }

  /**
   * Handle dry-run mode output
   */
  private static handleDryRun(
    injectOptions: InjectOptions,
    detectedHTML: HTMLDetectionResult,
    config: CSPConfig,
    envVars: EnvironmentVariables
  ): void {
    console.log(MESSAGES.DRY_RUN_PREFIX);
    console.log(`${EMOJI.FILE} Target HTML: ${detectedHTML.path}`);
    console.log(`${EMOJI.BUILD} Build Directory: ${detectedHTML.buildDir}`);

    CLI.reportConfigSource(injectOptions, envVars);
    CLI.reportEnvironmentVariables(envVars);
    CLI.reportConfiguration(config);

    console.log(`\n${MESSAGES.READY}`);
  }

  /**
   * Report configuration source
   */
  private static reportConfigSource(
    injectOptions: InjectOptions,
    envVars: EnvironmentVariables
  ): void {
    if (injectOptions.configPath) {
      console.log(`${EMOJI.CONFIG} Config: ${injectOptions.configPath}`);
    } else if (fs.existsSync('csp.config.json')) {
      console.log(`${EMOJI.CONFIG} Config: csp.config.json (auto-detected)`);
    } else {
      const hasFrameworkVars = CLI.hasFrameworkEnvironmentVariables(envVars);
      const configType = hasFrameworkVars
        ? 'Enhanced defaults (with environment variables)'
        : 'Using defaults';
      console.log(`${EMOJI.CONFIG} Config: ${configType}`);
    }
  }

  /**
   * Report environment variables by framework
   */
  private static reportEnvironmentVariables(envVars: EnvironmentVariables): void {
    console.log(`${EMOJI.ENV} Environment Variables: ${Object.keys(envVars).length} loaded`);

    const reactVars = CLI.getFrameworkVariables(envVars, 'REACT_APP_');
    const viteVars = CLI.getFrameworkVariables(envVars, 'VITE_');
    const angularVars = CLI.getFrameworkVariables(envVars, 'NG_');

    if (reactVars.length > 0) {
      const display = CLI.formatVariableList(reactVars);
      console.log(`${EMOJI.LINK} React Variables: ${reactVars.length} (${display})`);
    }

    if (viteVars.length > 0) {
      const display = CLI.formatVariableList(viteVars);
      console.log(`${EMOJI.LINK} VITE Variables: ${viteVars.length} (${display})`);
    }

    if (angularVars.length > 0) {
      const display = CLI.formatVariableList(angularVars);
      console.log(`${EMOJI.LINK} Angular Variables: ${angularVars.length} (${display})`);
    }
  }

  /**
   * Get framework-specific variables
   */
  private static getFrameworkVariables(envVars: EnvironmentVariables, prefix: string): string[] {
    return Object.keys(envVars).filter(key => key.startsWith(prefix));
  }

  /**
   * Format variable list for display
   */
  private static formatVariableList(variables: string[]): string {
    const maxDisplay = 3;
    const displayed = variables.slice(0, maxDisplay);
    const suffix = variables.length > maxDisplay ? '...' : '';
    return displayed.join(', ') + suffix;
  }

  /**
   * Check if environment variables contain framework-specific variables
   */
  private static hasFrameworkEnvironmentVariables(envVars: EnvironmentVariables): boolean {
    return Object.keys(envVars).some(
      key => key.startsWith('REACT_APP_') || key.startsWith('VITE_') || key.startsWith('NG_')
    );
  }

  /**
   * Report configuration details
   */
  private static reportConfiguration(config: CSPConfig): void {
    console.log(`${EMOJI.SETTINGS} CSP Directives: ${Object.keys(config.directives).length}`);
    console.log(`${EMOJI.DICE} Nonce: ${config.useNonce ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Report successful CSP injection results
   */
  private static reportSuccess(result: CSPInjectionResult): void {
    console.log(MESSAGES.SUCCESS);
    console.log(`${EMOJI.FILE} File: ${result.htmlPath}`);
    console.log(`🔒 Policy: ${result.cspString.length} characters`);

    if (result.nonce) {
      console.log(`${EMOJI.DICE} Nonce: ${result.nonce}`);
    }

    if (result.replacedTags > 0) {
      console.log(`${EMOJI.REPLACE} Replaced ${result.replacedTags} existing CSP tag(s)`);
    }

    CLI.reportUsedEnvironmentVariables(result.envVars);
  }

  /**
   * Report used environment variables
   */
  private static reportUsedEnvironmentVariables(envVars?: EnvironmentVariables): void {
    if (!envVars) return;

    const usedVars = Object.keys(envVars).filter(
      k =>
        k.startsWith('REACT_APP_') ||
        k.startsWith('VITE_') ||
        k.startsWith('NG_') ||
        k === 'NODE_ENV'
    );

    if (usedVars.length > 0) {
      console.log(`${EMOJI.ENV} Environment variables used: ${usedVars.length}`);
    }
  }

  /**
   * Handle injection errors with helpful suggestions
   */
  private static handleInjectionError(error: unknown, devMode?: boolean): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${MESSAGES.ERROR_PREFIX} ${errorMessage}`);

    if (errorMessage.includes('HTML file not found')) {
      CLI.showHTMLLocationSuggestions(devMode);
    }

    process.exit(1);
  }

  /**
   * Execute inject command
   */
  public static async injectCommand(options: CliOptions): Promise<void> {
    const injectOptions = CLI.buildInjectOptions(options);

    if (options[CLI_OPTIONS.DRY_RUN]) {
      await CLI.handleDryRunCommand(injectOptions);
      return;
    }

    // Actual injection
    try {
      const result = CSPInjector.inject(injectOptions);
      CLI.reportSuccess(result);
    } catch (error) {
      CLI.handleInjectionError(error, injectOptions.devMode);
    }
  }

  /**
   * Handle dry-run command
   */
  private static async handleDryRunCommand(injectOptions: InjectOptions): Promise<void> {
    // Find HTML file and create detection result
    const { htmlPath, detectedHTML } = CLI.findHTMLForDryRun(injectOptions);

    // Determine project root with workspace detection
    const projectRoot = CLI.determineProjectRootForDryRun(injectOptions, htmlPath);

    // Apply NODE_ENV and load configuration
    const originalNodeEnv = process.env['NODE_ENV'];
    let shouldRestoreNodeEnv = false;

    try {
      shouldRestoreNodeEnv = CLI.setNodeEnvForDryRun(injectOptions);

      // Load environment variables and configuration
      const envVars = CSPInjector.loadEnvironmentVariables(projectRoot);
      const config = CSPInjector.loadConfig(injectOptions.configPath, envVars);

      CLI.handleDryRun(injectOptions, detectedHTML, config, envVars);
    } finally {
      CLI.restoreNodeEnv(originalNodeEnv, shouldRestoreNodeEnv);
    }
  }

  /**
   * Find HTML file for dry-run command
   */
  private static findHTMLForDryRun(injectOptions: InjectOptions): {
    htmlPath: string;
    detectedHTML: HTMLDetectionResult;
  } {
    let htmlPath: string;
    let detectedHTML: HTMLDetectionResult;

    if (injectOptions.htmlPath) {
      const resolvedPath = path.resolve(process.cwd(), injectOptions.htmlPath);
      if (!fs.existsSync(resolvedPath)) {
        console.log(MESSAGES.DRY_RUN_PREFIX);
        console.log(`${EMOJI.FILE} Target HTML: Not found`);
        console.log(`${MESSAGES.ERROR_PREFIX} HTML file not found: ${resolvedPath}`);
        process.exit(1);
      }
      htmlPath = resolvedPath;

      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const hasExistingCSP =
        /^.*<meta\s+[^>]*http-equiv\s*=\s*["']Content-Security-Policy.*$/im.test(content);

      detectedHTML = {
        path: resolvedPath,
        buildDir: path.dirname(injectOptions.htmlPath),
        hasExistingCSP,
      };
    } else {
      // Auto-detect HTML file
      const detected = CSPInjector.detectHTML(injectOptions.devMode);
      if (!detected) {
        console.log(MESSAGES.DRY_RUN_PREFIX);
        console.log(`${EMOJI.FILE} Target HTML: Not found`);
        console.log(
          `${MESSAGES.ERROR_PREFIX} No HTML file found. Build your project first or specify --html path.`
        );
        CLI.showHTMLLocationSuggestions(injectOptions.devMode);
        process.exit(1);
      }
      htmlPath = detected.path;
      detectedHTML = detected;
    }

    return { htmlPath, detectedHTML };
  }

  /**
   * Determine project root for dry-run command (same logic as inject)
   */
  private static determineProjectRootForDryRun(
    injectOptions: InjectOptions,
    htmlPath: string
  ): string {
    // Start with config-based project root
    let projectRoot = process.cwd();
    if (injectOptions.configPath) {
      projectRoot = path.dirname(path.resolve(process.cwd(), injectOptions.configPath));
    }

    // Apply workspace detection logic (same as inject())
    if (!injectOptions.configPath) {
      const relativePath = path.relative(process.cwd(), htmlPath);
      const htmlPathNormalized = path.normalize(relativePath);

      // Check if this is an Angular workspace project pattern: projects/*/src/index.html
      const workspaceRegex = /^(.*)projects[/\\]([^/\\]+)[/\\]src[/\\]index\.html$/;
      const workspaceMatch = workspaceRegex.exec(htmlPathNormalized);
      if (workspaceMatch) {
        const [, workspaceRoot, projectName] = workspaceMatch;
        if (projectName) {
          const workspaceProjectRoot = path.resolve(
            process.cwd(),
            workspaceRoot ?? '',
            'projects',
            projectName
          );

          // Check if this workspace project has its own environment files
          const hasOwnEnvironment = fs.existsSync(
            path.join(workspaceProjectRoot, 'src', 'environments', 'environment.ts')
          );
          if (hasOwnEnvironment) {
            projectRoot = workspaceProjectRoot;
          }
        }
      }
    }

    return projectRoot;
  }

  /**
   * Set NODE_ENV for dry-run command (same logic as inject)
   */
  private static setNodeEnvForDryRun(injectOptions: InjectOptions): boolean {
    let shouldRestoreNodeEnv = false;

    if (!process.env['NODE_ENV']) {
      process.env['NODE_ENV'] = injectOptions.devMode === true ? 'development' : 'production';
      shouldRestoreNodeEnv = true;
    } else if (injectOptions.devMode === true && process.env['NODE_ENV'] === 'production') {
      process.env['NODE_ENV'] = 'development';
      shouldRestoreNodeEnv = true;
    } else if (injectOptions.devMode === false && process.env['NODE_ENV'] === 'development') {
      process.env['NODE_ENV'] = 'production';
      shouldRestoreNodeEnv = true;
    }

    return shouldRestoreNodeEnv;
  }

  /**
   * Restore NODE_ENV after dry-run command
   */
  private static restoreNodeEnv(originalNodeEnv: string | undefined, shouldRestore: boolean): void {
    if (shouldRestore) {
      if (originalNodeEnv !== undefined) {
        process.env['NODE_ENV'] = originalNodeEnv;
      } else {
        delete process.env['NODE_ENV'];
      }
    }
  }

  /**
   * Show helpful suggestions for common HTML file locations
   */
  private static showHTMLLocationSuggestions(devMode = false): void {
    console.log('\n💡 Common HTML file locations to check:');

    if (devMode) {
      CLI.showDevelopmentSuggestions();
    } else {
      CLI.showProductionSuggestions();
    }

    CLI.showExampleCommands(devMode);
  }

  /**
   * Show development mode suggestions
   */
  private static showDevelopmentSuggestions(): void {
    console.log('   🚀 Development mode (--dev):');
    console.log('      • src/index.html (Angular - used by ng serve)');
    console.log('      • projects/*/src/index.html (Angular workspace)');
    console.log('      • public/index.html (React CRA - used by dev server)');
    console.log('      • index.html (Vite - used by dev server)');
    console.log('\n   🔧 No build required! Modifies source files directly.');
  }

  /**
   * Show production mode suggestions
   */
  private static showProductionSuggestions(): void {
    console.log('   🏗️  Production mode (requires build first):');
    console.log('      • dist/index.html (Vite, Angular)');
    console.log('      • dist/*/index.html (Angular build)');
    console.log('      • build/index.html (React CRA build)');
    console.log('      • www/index.html (Ionic)');
    console.log('      • projects/*/dist/*/index.html (Angular workspace)');
    console.log('\n   📦 Build your project first, then run CSP injection.');
  }

  /**
   * Show example commands
   */
  private static showExampleCommands(devMode: boolean): void {
    console.log('\n   📝 Examples:');

    if (devMode) {
      console.log('      npx @arc/spa-csp --dev --html src/index.html');
      console.log('      npx @arc/spa-csp --dev --html projects/my-app/src/index.html');
      console.log('      npx @arc/spa-csp --dev --html public/index.html');
    } else {
      console.log('      npx @arc/spa-csp --html dist/my-app/index.html');
      console.log('      npx @arc/spa-csp --html build/index.html');
      console.log('      npx @arc/spa-csp --html www/index.html');
    }
  }

  /**
   * Check if options contain help or version flags
   */
  private static shouldShowHelp(args: string[], options: CliOptions): boolean {
    return !!options[CLI_OPTIONS.HELP] || args.includes('--help');
  }

  /**
   * Check if options contain version flags
   */
  private static shouldShowVersion(args: string[], options: CliOptions): boolean {
    const versionKeys = CLI_OPTIONS.VERSION;
    return versionKeys.some(key => !!options[key]) || args.includes('--version');
  }

  /**
   * Prompt user for input (simple readline implementation)
   */
  private static async promptUser(question: string): Promise<string> {
    return new Promise(resolve => {
      process.stdout.write(question);
      process.stdin.once('data', data => {
        resolve(data.toString().trim());
      });
    });
  }

  /**
   * Interactive framework selection
   */
  private static async selectFramework(): Promise<FrameworkChoice> {
    const frameworks: FrameworkChoice[] = [
      {
        name: 'React (Create React App)',
        value: 'react',
        envPrefix: 'REACT_APP_',
        description: 'Traditional React with Create React App',
      },
      {
        name: 'VITE (React/Vue/Vanilla)',
        value: 'vite',
        envPrefix: 'VITE_',
        description: 'Modern build tool with fast HMR',
      },
      {
        name: 'Angular CLI',
        value: 'angular',
        envPrefix: 'NG_',
        description: 'Angular framework with CLI',
      },
      {
        name: 'Generic/Other',
        value: 'generic',
        envPrefix: '',
        description: 'Other frameworks or custom setup',
      },
    ];

    console.log(`\n${EMOJI.FRAMEWORK} Which framework are you using?`);
    frameworks.forEach((fw, index) => {
      console.log(`  ${index + 1}. ${fw.name} - ${fw.description}`);
    });

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const choice = await CLI.promptUser('\nSelect framework (1-4): ');
      const index = parseInt(choice) - 1;

      if (index >= 0 && index < frameworks.length) {
        const selected = frameworks[index];
        if (selected) {
          return selected;
        }
      }

      console.log('❌ Invalid choice. Please select 1-4.');
    }
  }

  /**
   * Ask yes/no question
   */
  private static async askYesNo(question: string, defaultValue = false): Promise<boolean> {
    const defaultText = defaultValue ? '[Y/n]' : '[y/N]';
    const answer = await CLI.promptUser(`${question} ${defaultText}: `);

    if (answer === '') return defaultValue;
    return answer.toLowerCase().startsWith('y');
  }

  /**
   * Select configuration type
   */
  private static async selectConfigType(): Promise<'development' | 'production' | 'custom'> {
    console.log(`\n${EMOJI.SETTINGS} Configuration type:`);
    console.log('  1. Development (permissive, good for testing)');
    console.log('  2. Production (strict, secure for deployment)');
    console.log('  3. Custom (configure directives manually)');

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const choice = await CLI.promptUser('\nSelect type (1-3): ');

      switch (choice) {
        case '1':
          return 'development';
        case '2':
          return 'production';
        case '3':
          return 'custom';
        default:
          console.log('❌ Invalid choice. Please select 1-3.');
      }
    }
  }

  /**
   * Interactive configuration setup
   */
  private static async getInteractiveConfig(): Promise<InteractiveConfig> {
    console.log(`\n🎉 Welcome to @arc/spa-csp configuration wizard!`);
    console.log("Let's set up your Content Security Policy configuration.\n");

    // Framework selection
    const framework = await CLI.selectFramework();
    console.log(`✅ Selected: ${framework.name}`);

    // Configuration type
    const configType = await CLI.selectConfigType();
    console.log(`✅ Configuration type: ${configType}`);

    // Nonce support
    const useNonce = await CLI.askYesNo(
      `\n${EMOJI.SECURITY} Enable nonce for inline scripts/styles? (recommended for production)`,
      configType === 'production'
    );

    // Report-only mode
    const reportOnly = await CLI.askYesNo(
      `\n${EMOJI.QUESTION} Use report-only mode? (logs violations without blocking)`,
      false
    );

    // Environment variables
    let includeEnvVars = false;
    if (framework.envPrefix) {
      includeEnvVars = await CLI.askYesNo(
        `\n${EMOJI.ENV} Include ${framework.envPrefix}* environment variable templates?`,
        true
      );
    }

    return {
      framework: framework.value,
      useNonce,
      reportOnly,
      includeEnvVars,
      configType,
    };
  }

  /**
   * Get framework-specific directives with optimized configuration
   */
  private static getFrameworkDirectives(
    framework: string,
    configType: string
  ): Record<string, string[]> {
    // Common directives for all frameworks
    const commonDirectives: Record<string, string[]> = {
      'default-src': ["'self'"],
      'img-src': ["'self'", 'data:', 'blob:'],
      'font-src': ["'self'", 'data:'],
      'style-src': ["'self'", "'unsafe-inline'"], // All frameworks need this for various reasons
    };

    // Build script-src based on configuration type
    const scriptSrc = ["'self'"];
    if (configType === 'development') {
      scriptSrc.push("'unsafe-inline'");
    }

    // Framework-specific overrides and additions
    const frameworkSpecific: Record<string, Record<string, string[]>> = {
      react: {
        'script-src': scriptSrc,
        'connect-src': ["'self'"],
      },
      vite: {
        'script-src': scriptSrc,
        'connect-src': ["'self'", 'ws:', 'wss:'], // VITE HMR WebSocket
        'worker-src': ["'self'", 'blob:'],
      },
      angular: {
        'script-src': scriptSrc,
        'connect-src': ["'self'"],
        'worker-src': ["'self'", 'blob:'],
        'manifest-src': ["'self'"], // Angular PWA support
      },
      generic: {
        'script-src': ["'self'", "'unsafe-inline'"], // More permissive for unknown frameworks
        'connect-src': ["'self'"],
      },
    };

    // Get framework config or default to generic
    const specificConfig = frameworkSpecific[framework] || frameworkSpecific['generic'];

    // Merge common directives with framework-specific ones
    return {
      ...commonDirectives,
      ...specificConfig,
    };
  }

  /**
   * Add environment variable templates to directives
   */
  private static addEnvironmentVariables(
    directives: Record<string, string[]>,
    framework: string,
    includeEnvVars: boolean
  ): void {
    if (!includeEnvVars) return;

    // Framework to environment prefix mapping
    const frameworkPrefixes: Record<string, string> = {
      react: 'REACT_APP_',
      vite: 'VITE_',
      angular: 'NG_',
    };

    const envPrefix = frameworkPrefixes[framework];
    if (!envPrefix) return;

    // Add environment variable templates to relevant directives
    const directivesToEnhance = ['script-src', 'connect-src', 'img-src'] as const;
    const templateVariables = {
      'script-src': [`{{${envPrefix}API_URL}}`],
      'connect-src': [`{{${envPrefix}API_URL}}`],
      'img-src': [`{{${envPrefix}CDN_URL}}`],
    };

    directivesToEnhance.forEach(directive => {
      const existingDirective = directives[directive];
      const templates = templateVariables[directive];
      if (existingDirective && templates) {
        existingDirective.push(...templates);
      }
    });
  }

  /**
   * Add nonce templates to directives
   */
  private static addNonceTemplates(directives: Record<string, string[]>, useNonce: boolean): void {
    if (!useNonce) return;

    const scriptSrc = directives['script-src'];
    const styleSrc = directives['style-src'];

    if (scriptSrc) scriptSrc.push("'nonce-{{nonce}}'");
    if (styleSrc) styleSrc.push("'nonce-{{nonce}}'");
  }

  /**
   * Generate config based on interactive choices
   */
  private static createInteractiveConfig(choices: InteractiveConfig): object {
    // Get framework-specific directives
    const baseDirectives = CLI.getFrameworkDirectives(choices.framework, choices.configType);

    // Add environment variable templates
    CLI.addEnvironmentVariables(baseDirectives, choices.framework, choices.includeEnvVars);

    // Clean up empty values
    Object.keys(baseDirectives).forEach(key => {
      const directive = baseDirectives[key];
      if (directive) {
        baseDirectives[key] = directive.filter(val => val?.trim());
      }
    });

    // Add nonce template if enabled
    CLI.addNonceTemplates(baseDirectives, choices.useNonce);

    return {
      directives: baseDirectives,
      useNonce: choices.useNonce,
      reportOnly: choices.reportOnly,
    };
  }

  /**
   * Handle init command to create default config file
   */
  public static async initCommand(interactive = false): Promise<void> {
    const configPath = path.resolve(process.cwd(), 'csp.config.json');

    if (fs.existsSync(configPath)) {
      console.log(`${EMOJI.CONFIG} Config file already exists: csp.config.json`);
      console.log('💡 Use --config flag to specify a different config file name');
      return;
    }

    let config: object;

    if (interactive) {
      // Enable raw mode for better input handling
      process.stdin?.isTTY && process.stdin.setRawMode(false);
      process.stdin.resume();

      try {
        const choices = await CLI.getInteractiveConfig();
        config = CLI.createInteractiveConfig(choices);

        console.log(`\n${EMOJI.CONFIG} Configuration summary:`);
        console.log(`  Framework: ${choices.framework}`);
        console.log(`  Type: ${choices.configType}`);
        console.log(`  Nonce: ${choices.useNonce ? 'enabled' : 'disabled'}`);
        console.log(`  Report-only: ${choices.reportOnly ? 'enabled' : 'disabled'}`);
        console.log(
          `  Environment variables: ${choices.includeEnvVars ? 'included' : 'not included'}`
        );
      } finally {
        process.stdin.pause();
      }
    } else {
      // Default non-interactive config
      config = {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:'],
          'font-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          'worker-src': ["'self'", 'blob:'],
          'manifest-src': ["'self'"],
        },
        useNonce: false,
        reportOnly: false,
      };
    }

    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log(`\n${EMOJI.CONFIG} Created config file: csp.config.json`);
      console.log('');
      console.log('💡 Next steps:');
      console.log('   1. Edit csp.config.json to customize CSP directives');
      console.log('   2. Add environment variables like {{REACT_APP_API_URL}}');
      console.log('   3. Run: arc-spa-csp --dry-run (to preview changes)');
      console.log('   4. Run: arc-spa-csp (to inject CSP)');
      console.log('');
      console.log('📚 For environment variable templates, see:');
      console.log('   React: {{REACT_APP_*}} variables');
      console.log('   VITE: {{VITE_*}} variables');
      console.log('   Angular: {{NG_*}} variables');
    } catch (error) {
      console.error(`${MESSAGES.ERROR_PREFIX} Failed to create config file`);
      console.error((error as Error)?.message ?? 'Unknown error');
      process.exit(1);
    }
  }

  /**
   * Main CLI entry point
   */
  public static async main(): Promise<void> {
    try {
      const args = process.argv.slice(2);
      const parsed = CLI.parseArguments(args);

      // Handle help and version
      if (CLI.shouldShowHelp(args, parsed.options)) {
        CLI.printHelp();
        process.exit(0);
      }

      if (CLI.shouldShowVersion(args, parsed.options)) {
        console.log(CLI_VERSION);
        process.exit(0);
      }

      // Handle init command
      if (parsed.options[CLI_OPTIONS.INIT] || parsed.positional.includes('init')) {
        const interactive =
          !!CLI.getOptionValue(parsed.options, CLI_OPTIONS.INTERACTIVE) ||
          parsed.positional.includes('--interactive') ||
          parsed.positional.includes('-i');
        await CLI.initCommand(interactive);
        return;
      }

      // Default to inject command
      await CLI.injectCommand(parsed.options);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`${MESSAGES.ERROR_PREFIX} ${errorMessage}`);
      process.exit(1);
    }
  }
}

// Run CLI if called directly
if (require.main === module) {
  CLI.main();
}
