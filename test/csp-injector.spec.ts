import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CSPInjector, CSPConfig, EnvironmentVariables } from '../src/csp-injector';

// Test constants for better maintainability
const TEST_CONSTANTS = {
  CONFIG: {
    BASIC: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'"],
      },
      useNonce: false,
      reportOnly: false,
    } as CSPConfig,
    WITH_NONCE: {
      directives: {
        'script-src': ["'self'", "'nonce-{{nonce}}'"],
      },
    } as Partial<CSPConfig>,
  },
  HTML: {
    BASIC: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test App</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`,
    WITH_CSP: `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'">
  <title>Test</title>
</head>
<body></body>
</html>`,
  },
  ENV_VARS: {
    REACT: {
      REACT_APP_API_URL: 'https://api.example.com',
      REACT_APP_THIRD_PARTY_API: 'https://third-party.com',
      REACT_APP_CUSTOM_ENDPOINT: 'https://custom.service.com',
      NODE_ENV: 'development',
    },
    ANGULAR: {
      NG_API_URL: 'https://angular-api.com',
      NG_CUSTOM_SERVICE: 'https://angular-service.com',
      NG_ANALYTICS: 'https://analytics.com',
      NODE_ENV: 'development',
    },
    MIXED: {
      REACT_APP_API_URL: 'https://react-api.com',
      REACT_APP_CDN: 'https://react-cdn.com',
      NG_API_URL: 'https://angular-api.com',
      NG_SERVICE: 'https://angular-service.com',
      NODE_ENV: 'development',
    },
    ARBITRARY_NAMES: {
      REACT_APP_WEIRD_SERVICE_NAME: 'https://weird.service.io',
      REACT_APP_PAYMENTS_GATEWAY: 'https://payments.stripe.com',
      REACT_APP_THIRD_PARTY_ANALYTICS: 'https://analytics.custom.com',
    },
  },
} as const;

/**
 * Test helper functions
 */
class TestHelpers {
  private static originalEnvVars: Record<string, string | undefined> = {};
  private static originalCwd = '';

  static createConfigFile(tempDir: string, config: object, filename = 'test-config.json'): string {
    const configPath = path.join(tempDir, filename);
    fs.writeFileSync(configPath, JSON.stringify(config));
    return configPath;
  }

  static createHTMLFile(content: string, filePath: string): void {
    fs.writeFileSync(filePath, content);
  }

  static setupDirectoryStructure(tempDir: string, structure: Record<string, string>): void {
    Object.entries(structure).forEach(([dir, content]) => {
      const fullPath = path.join(tempDir, dir);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    });
  }

  static setEnvironmentVariables(envVars: EnvironmentVariables): void {
    // Store original values
    Object.keys(envVars).forEach(key => {
      TestHelpers.originalEnvVars[key] = process.env[key];
      if (envVars[key] !== undefined) {
        process.env[key] = envVars[key];
      }
    });
  }

  static restoreEnvironmentVariables(envVars: EnvironmentVariables): void {
    // Restore original values
    Object.keys(envVars).forEach(key => {
      if (TestHelpers.originalEnvVars[key] !== undefined) {
        process.env[key] = TestHelpers.originalEnvVars[key];
      } else {
        delete process.env[key];
      }
    });
  }

  static withTemporaryEnvironment<T>(envVars: EnvironmentVariables, fn: () => T): T {
    TestHelpers.setEnvironmentVariables(envVars);
    try {
      return fn();
    } finally {
      TestHelpers.restoreEnvironmentVariables(envVars);
    }
  }

  static setWorkingDirectory(tempDir: string): void {
    TestHelpers.originalCwd = process.cwd();
    process.chdir(tempDir);
  }

  static restoreWorkingDirectory(): void {
    if (TestHelpers.originalCwd) {
      process.chdir(TestHelpers.originalCwd);
    }
  }

  static withTemporaryWorkingDirectory<T>(tempDir: string, fn: () => T): T {
    TestHelpers.setWorkingDirectory(tempDir);
    try {
      return fn();
    } finally {
      TestHelpers.restoreWorkingDirectory();
    }
  }

  static expectCSPContent(
    htmlContent: string,
    expectedContent: string[],
    unexpectedContent: string[] = []
  ): void {
    expectedContent.forEach(content => {
      expect(htmlContent).toContain(content);
    });

    unexpectedContent.forEach(content => {
      expect(htmlContent).not.toContain(content);
    });
  }

  static runWithProductionEnvironment(testFn: () => void): void {
    TestHelpers.withTemporaryEnvironment({ NODE_ENV: 'production' }, testFn);
  }

  static validateEnhancedDefaults(
    frameworkVars: Record<string, string>,
    expectedVarSubset: string[]
  ): void {
    const config = CSPInjector.loadConfig();
    expectedVarSubset.forEach(varName => {
      expect(config.directives['connect-src']).toContain(`{{${varName}}}`);
    });
  }

  static validateVariableResolution(envVars: EnvironmentVariables, expectedUrls: string[]): void {
    const config = CSPInjector.loadConfig(undefined, envVars);
    const injector = new CSPInjector(config, envVars);
    const csp = injector.buildCSP();

    expectedUrls.forEach(url => {
      expect(csp).toContain(url);
    });

    // Verify no unresolved placeholders
    Object.keys(envVars).forEach(key => {
      if (key.startsWith('REACT_APP_') || key.startsWith('NG_')) {
        expect(csp).not.toContain(`{{${key}}}`);
      }
    });
  }

  static testHTMLDetection(
    structure: Record<string, string>,
    devMode: boolean,
    expectedPath: string,
    tempDir: string
  ): void {
    TestHelpers.setupDirectoryStructure(tempDir, structure);
    const result = CSPInjector.detectHTML(devMode);

    expect(result).not.toBeNull();
    expect(fs.realpathSync(result!.path)).toBe(fs.realpathSync(path.join(tempDir, expectedPath)));
  }

  static validateCSPInjection(
    config: Partial<CSPConfig>,
    expectedContent: string[],
    unexpectedContent: string[],
    testHtmlPath: string
  ): void {
    const injector = new CSPInjector(config);
    const result = injector.injectCSP(testHtmlPath);

    expect(result.htmlPath).toBe(testHtmlPath);
    expect(result.cspString).toBeTruthy();

    const htmlContent = fs.readFileSync(testHtmlPath, 'utf-8');
    TestHelpers.expectCSPContent(htmlContent, expectedContent, unexpectedContent);
  }

  // New helper methods to reduce nesting

  static testEnhancedDefaultsWithEnvironment(
    tempDir: string,
    envVars: EnvironmentVariables,
    expectedVars: string[]
  ): void {
    TestHelpers.withTemporaryWorkingDirectory(tempDir, () => {
      TestHelpers.withTemporaryEnvironment(envVars, () => {
        TestHelpers.validateEnhancedDefaults(envVars as Record<string, string>, expectedVars);
      });
    });
  }

  static testVariableResolutionWithEnvironment(
    tempDir: string,
    envVars: EnvironmentVariables,
    expectedUrls: string[]
  ): void {
    TestHelpers.withTemporaryWorkingDirectory(tempDir, () => {
      TestHelpers.withTemporaryEnvironment(envVars, () => {
        TestHelpers.validateVariableResolution(envVars, expectedUrls);
      });
    });
  }

  static testHTMLDetectionWithWorkingDirectory(
    tempDir: string,
    structure: Record<string, string>,
    devMode: boolean,
    expectedPath: string
  ): void {
    TestHelpers.withTemporaryWorkingDirectory(tempDir, () => {
      TestHelpers.testHTMLDetection(structure, devMode, expectedPath, tempDir);
    });
  }

  // eslint-disable-next-line jest/expect-expect
  static testProductionConfigInWorkingDirectory(tempDir: string): void {
    TestHelpers.withTemporaryWorkingDirectory(tempDir, () => {
      TestHelpers.runWithProductionEnvironment(() => {
        const config = CSPInjector.loadConfig();
        expect(config.useNonce).toBe(true);
        expect(config.nonceLength).toBe(24);
      });
    });
  }

  static testEnvironmentVariableInjection(tempDir: string, testHtmlPath: string): void {
    const envVars: EnvironmentVariables = {
      REACT_APP_API_URL: 'https://api.example.com',
    };

    TestHelpers.withTemporaryWorkingDirectory(tempDir, () => {
      TestHelpers.withTemporaryEnvironment(envVars, () => {
        const config = CSPInjector.loadConfig(undefined, envVars);
        const injector = new CSPInjector(config, envVars);
        const result = injector.injectCSP(testHtmlPath);

        expect(result.envVars).toBe(envVars);

        const htmlContent = fs.readFileSync(testHtmlPath, 'utf-8');
        expect(htmlContent).toContain('https://api.example.com');
        expect(htmlContent).not.toContain('{{REACT_APP_API_URL}}');
      });
    });
  }

  static testAutoDetectHTMLFile(tempDir: string): string {
    return TestHelpers.withTemporaryWorkingDirectory(tempDir, () => {
      TestHelpers.setupDirectoryStructure(tempDir, {
        'dist/index.html': TEST_CONSTANTS.HTML.BASIC,
      });

      const result = CSPInjector.inject();
      expect(result.htmlPath).toBeTruthy();
      return result.htmlPath;
    });
  }

  static testEnhancedDefaultsWithMultipleEnvVars(tempDir: string, testHtmlPath: string): void {
    const envVars: EnvironmentVariables = {
      REACT_APP_API_URL: 'https://api.example.com',
      REACT_APP_CDN: 'https://cdn.example.com',
    };

    TestHelpers.withTemporaryWorkingDirectory(tempDir, () => {
      TestHelpers.withTemporaryEnvironment(envVars, () => {
        const result = CSPInjector.inject({
          htmlPath: testHtmlPath,
          envVars,
        });

        expect(result.cspString).toContain('https://api.example.com');
        expect(result.cspString).toContain('https://cdn.example.com');
      });
    });
  }

  static testProductionEnhancedDefaults(tempDir: string): void {
    const envVars: EnvironmentVariables = {
      REACT_APP_API_URL: 'https://api.example.com',
      NODE_ENV: 'production',
    };

    TestHelpers.withTemporaryWorkingDirectory(tempDir, () => {
      TestHelpers.withTemporaryEnvironment(envVars, () => {
        const config = CSPInjector.loadConfig(undefined, envVars);

        // Should be based on production config (with nonce enabled)
        expect(config.useNonce).toBe(true);
        expect(config.nonceLength).toBe(24);

        // But should still include environment variables
        expect(config.directives['connect-src']).toContain('{{REACT_APP_API_URL}}');
      });
    });
  }
}

describe('CSPInjector', () => {
  let tempDir: string;
  let testHtmlPath: string;

  beforeEach(() => {
    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csp-test-'));
    testHtmlPath = path.join(tempDir, 'index.html');
  });

  afterEach(() => {
    // Clean up temporary files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Constructor and Configuration', () => {
    it('should create instance with default config', () => {
      const injector = new CSPInjector();
      expect(injector).toBeInstanceOf(CSPInjector);
    });

    it('should create instance with production config', () => {
      const injector = new CSPInjector(CSPInjector.PRODUCTION_CONFIG);
      expect(injector).toBeInstanceOf(CSPInjector);
    });

    it('should merge user config with defaults', () => {
      const customConfig: Partial<CSPConfig> = {
        directives: {
          'script-src': ["'self'", 'https://example.com'],
        },
        useNonce: true,
      };
      const injector = new CSPInjector(customConfig);
      expect(injector).toBeInstanceOf(CSPInjector);
    });
  });

  describe('Configuration Loading', () => {
    it('should load config from file', () => {
      const configPath = TestHelpers.createConfigFile(tempDir, TEST_CONSTANTS.CONFIG.BASIC);

      const loadedConfig = CSPInjector.loadConfig(configPath);
      expect(loadedConfig.directives['default-src']).toEqual(["'self'"]);
      expect(loadedConfig.useNonce).toBe(false);
    });

    it('should handle missing config file gracefully', () => {
      const config = CSPInjector.loadConfig(path.join(tempDir, 'nonexistent.json'));
      expect(config).toEqual(CSPInjector.DEFAULT_CONFIG);
    });

    // eslint-disable-next-line jest/expect-expect
    it('should use production config when NODE_ENV is production', () => {
      TestHelpers.testProductionConfigInWorkingDirectory(tempDir);
    });
  });

  describe('Enhanced Defaults with Environment Variables', () => {
    // eslint-disable-next-line jest/expect-expect
    it('should create enhanced defaults with React environment variables', () => {
      TestHelpers.testEnhancedDefaultsWithEnvironment(tempDir, TEST_CONSTANTS.ENV_VARS.REACT, [
        'REACT_APP_API_URL',
        'REACT_APP_THIRD_PARTY_API',
        'REACT_APP_CUSTOM_ENDPOINT',
      ]);
    });

    // eslint-disable-next-line jest/expect-expect
    it('should create enhanced defaults with Angular environment variables', () => {
      TestHelpers.testEnhancedDefaultsWithEnvironment(tempDir, TEST_CONSTANTS.ENV_VARS.ANGULAR, [
        'NG_API_URL',
        'NG_CUSTOM_SERVICE',
        'NG_ANALYTICS',
      ]);
    });

    // eslint-disable-next-line jest/expect-expect
    it('should create enhanced defaults with mixed React and Angular variables', () => {
      TestHelpers.testEnhancedDefaultsWithEnvironment(tempDir, TEST_CONSTANTS.ENV_VARS.MIXED, [
        'REACT_APP_API_URL',
        'REACT_APP_CDN',
        'NG_API_URL',
        'NG_SERVICE',
      ]);
    });

    // eslint-disable-next-line jest/expect-expect
    it('should use production enhanced defaults when NODE_ENV is production', () => {
      TestHelpers.testProductionEnhancedDefaults(tempDir);
    });

    it('should fall back to default config when no framework variables found', () => {
      const envVars: EnvironmentVariables = {
        API_URL: 'https://api.example.com', // Not React/Angular prefixed
        SOME_OTHER_VAR: 'value',
        NODE_ENV: 'development',
      };

      const config = CSPInjector.loadConfig(undefined, envVars);

      // Should fall back to default config
      expect(config).toEqual(CSPInjector.DEFAULT_CONFIG);
    });

    it('should prioritize config file over enhanced defaults', () => {
      const envVars: EnvironmentVariables = {
        REACT_APP_API_URL: 'https://api.example.com',
      };

      const configContent = {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", "'unsafe-eval'"], // Different from defaults
        },
      };

      const configPath = TestHelpers.createConfigFile(tempDir, configContent);
      const config = CSPInjector.loadConfig(configPath, envVars);

      // Should use config file, not enhanced defaults
      expect(config.directives['script-src']).toContain("'unsafe-eval'");
      expect(config.directives['script-src']).not.toContain('{{REACT_APP_API_URL}}');
    });
  });

  describe('Environment Variable Resolution', () => {
    // eslint-disable-next-line jest/expect-expect
    it('should resolve React environment variables in CSP', () => {
      TestHelpers.testVariableResolutionWithEnvironment(tempDir, TEST_CONSTANTS.ENV_VARS.REACT, [
        'https://api.example.com',
        'https://third-party.com',
        'https://custom.service.com',
      ]);
    });

    // eslint-disable-next-line jest/expect-expect
    it('should resolve Angular environment variables in CSP', () => {
      TestHelpers.testVariableResolutionWithEnvironment(tempDir, TEST_CONSTANTS.ENV_VARS.ANGULAR, [
        'https://angular-api.com',
        'https://angular-service.com',
        'https://analytics.com',
      ]);
    });

    // eslint-disable-next-line jest/expect-expect
    it('should handle arbitrary React variable names', () => {
      TestHelpers.testVariableResolutionWithEnvironment(
        tempDir,
        TEST_CONSTANTS.ENV_VARS.ARBITRARY_NAMES,
        ['https://weird.service.io', 'https://payments.stripe.com', 'https://analytics.custom.com']
      );
    });
  });

  describe('HTML File Detection', () => {
    // eslint-disable-next-line jest/expect-expect
    it('should detect HTML in development mode', () => {
      TestHelpers.testHTMLDetectionWithWorkingDirectory(
        tempDir,
        { 'src/index.html': TEST_CONSTANTS.HTML.BASIC },
        true,
        'src/index.html'
      );
    });

    // eslint-disable-next-line jest/expect-expect
    it('should detect HTML in production mode', () => {
      TestHelpers.testHTMLDetectionWithWorkingDirectory(
        tempDir,
        { 'dist/index.html': TEST_CONSTANTS.HTML.WITH_CSP },
        false,
        'dist/index.html'
      );
    });

    it('should return null when no HTML file found', () => {
      TestHelpers.withTemporaryWorkingDirectory(tempDir, () => {
        const result = CSPInjector.detectHTML();
        expect(result).toBeNull();
      });
    });
  });

  describe('CSP Building', () => {
    it('should build basic CSP string', () => {
      const injector = new CSPInjector();
      const csp = injector.buildCSP();

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' 'unsafe-inline'");
      expect(csp).toContain('; ');
    });

    it('should build CSP with nonce', () => {
      const injector = new CSPInjector(TEST_CONSTANTS.CONFIG.WITH_NONCE);
      const nonce = 'test-nonce-123';
      const csp = injector.buildCSP(nonce);

      expect(csp).toContain(`'nonce-${nonce}'`);
      expect(csp).not.toContain('{{nonce}}');
    });
  });

  describe('Nonce Generation', () => {
    it('should generate cryptographically secure nonce', () => {
      const injector = new CSPInjector();
      const nonce1 = injector.generateNonce();
      const nonce2 = injector.generateNonce();

      expect(nonce1).not.toBe(nonce2);
      expect(nonce1.length).toBeGreaterThan(10);
      expect(typeof nonce1).toBe('string');
    });

    it('should respect custom nonce length', () => {
      const injector = new CSPInjector({ nonceLength: 32 });
      const nonce = injector.generateNonce();

      // Base64 encoding makes actual string longer than byte length
      expect(nonce.length).toBeGreaterThan(40);
    });
  });

  describe('CSP Injection', () => {
    beforeEach(() => {
      TestHelpers.createHTMLFile(TEST_CONSTANTS.HTML.BASIC, testHtmlPath);
    });

    // eslint-disable-next-line jest/expect-expect
    it('should inject CSP meta tag successfully', () => {
      TestHelpers.validateCSPInjection(
        {},
        ['<meta http-equiv="Content-Security-Policy"', "default-src 'self'"],
        [],
        testHtmlPath
      );
    });

    // eslint-disable-next-line jest/expect-expect
    it('should use report-only mode when configured', () => {
      TestHelpers.validateCSPInjection(
        { reportOnly: true },
        ['Content-Security-Policy-Report-Only'],
        ['http-equiv="Content-Security-Policy"'],
        testHtmlPath
      );
    });

    it('should replace existing CSP tags', () => {
      TestHelpers.createHTMLFile(TEST_CONSTANTS.HTML.WITH_CSP, testHtmlPath);

      const injector = new CSPInjector();
      const result = injector.injectCSP(testHtmlPath);

      expect(result.replacedTags).toBe(1);

      const htmlContent = fs.readFileSync(testHtmlPath, 'utf-8');
      expect(htmlContent).not.toContain("default-src 'none'");
      expect(htmlContent).toContain("default-src 'self'");
    });

    it('should generate nonce when configured', () => {
      const injector = new CSPInjector({ useNonce: true });
      const result = injector.injectCSP(testHtmlPath);

      expect(result.nonce).toBeTruthy();
      expect(typeof result.nonce).toBe('string');
    });

    // eslint-disable-next-line jest/expect-expect
    it('should inject CSP with environment variables resolved', () => {
      TestHelpers.testEnvironmentVariableInjection(tempDir, testHtmlPath);
    });
  });

  describe('Static inject method', () => {
    beforeEach(() => {
      TestHelpers.createHTMLFile(TEST_CONSTANTS.HTML.BASIC, testHtmlPath);
    });

    it('should inject CSP with explicit HTML path', () => {
      const result = CSPInjector.inject({ htmlPath: testHtmlPath });
      expect(result.htmlPath).toBe(testHtmlPath);
    });

    it('should inject CSP with custom config', () => {
      const customConfig: Partial<CSPConfig> = {
        directives: {
          'default-src': ["'none'"],
          'script-src': ["'self'"],
        },
      };

      const result = CSPInjector.inject({
        htmlPath: testHtmlPath,
        config: customConfig,
      });

      expect(result.cspString).toContain("default-src 'none'");
    });

    it('should throw error when HTML file not found', () => {
      expect(() => {
        CSPInjector.inject({ htmlPath: '/nonexistent/path.html' });
      }).toThrow('HTML file not found');
    });

    // eslint-disable-next-line jest/expect-expect
    it('should auto-detect HTML file', () => {
      TestHelpers.testAutoDetectHTMLFile(tempDir);
    });

    // eslint-disable-next-line jest/expect-expect
    it('should use enhanced defaults when environment variables present', () => {
      TestHelpers.testEnhancedDefaultsWithMultipleEnvVars(tempDir, testHtmlPath);
    });
  });

  describe('Configuration File Creation', () => {
    it('should create default config structure', () => {
      const config = CSPInjector.DEFAULT_CONFIG;

      expect(config.directives).toHaveProperty('default-src');
      expect(config.directives).toHaveProperty('script-src');
      expect(config.directives).toHaveProperty('style-src');
      expect(config.directives).toHaveProperty('img-src');
      expect(config.directives).toHaveProperty('font-src');
      expect(config.directives).toHaveProperty('connect-src');
      expect(config.directives).toHaveProperty('worker-src');
      expect(config.directives).toHaveProperty('manifest-src');

      expect(config.useNonce).toBe(false);
      expect(config.reportOnly).toBe(false);
    });

    it('should generate proper config JSON structure', () => {
      const config = CSPInjector.DEFAULT_CONFIG;
      const jsonString = JSON.stringify(config, null, 2);
      const parsed = JSON.parse(jsonString);

      expect(parsed.directives['default-src']).toEqual(["'self'"]);
      expect(parsed.directives['script-src']).toContain("'self'");
      expect(parsed.directives['script-src']).toContain("'unsafe-inline'");
      expect(parsed.useNonce).toBe(false);
    });
  });
});
