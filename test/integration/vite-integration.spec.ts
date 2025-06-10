/**
 * Integration tests for VITE project CSP injection
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CSPInjector } from '../../src/csp-injector';

describe('VITE Integration Tests', () => {
  let tempDir: string;
  let viteProjectDir: string;

  beforeEach(() => {
    // Create temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csp-vite-test-'));
    viteProjectDir = path.join(tempDir, 'vite-project');
    fs.mkdirSync(viteProjectDir);
  });

  afterEach(() => {
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const createViteProject = (withEnv = true, withConfig = true): void => {
    // Create package.json
    const packageJson = {
      name: 'test-vite-project',
      dependencies: {
        react: '^18.0.0',
        vite: '^4.0.0',
      },
    };
    fs.writeFileSync(
      path.join(viteProjectDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create root index.html (VITE dev)
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
    fs.writeFileSync(path.join(viteProjectDir, 'index.html'), indexHtml);

    // Create dist directory and build output
    const distDir = path.join(viteProjectDir, 'dist');
    fs.mkdirSync(distDir);
    const distIndexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React</title>
    <script type="module" crossorigin src="/assets/index-abc123.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-def456.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
    fs.writeFileSync(path.join(distDir, 'index.html'), distIndexHtml);

    if (withEnv) {
      // Create .env file
      const envContent = `VITE_API_URL=https://api.vite.example.com
VITE_CDN_URL=https://cdn.vite.example.com
VITE_APP_NAME=Test Vite App
REACT_APP_MIXED=mixed-value`;
      fs.writeFileSync(path.join(viteProjectDir, '.env'), envContent);
    }

    if (withConfig) {
      // Create CSP config
      const cspConfig = {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", '{{VITE_API_URL}}'],
          'connect-src': ["'self'", '{{VITE_API_URL}}'],
          'img-src': ["'self'", 'data:', '{{VITE_CDN_URL}}'],
        },
        useNonce: true,
      };
      fs.writeFileSync(
        path.join(viteProjectDir, 'csp.config.json'),
        JSON.stringify(cspConfig, null, 2)
      );
    }
  };

  describe('VITE Environment Variable Detection', () => {
    it('should detect VITE project correctly', () => {
      createViteProject();

      const envVars = CSPInjector.loadEnvironmentVariables(viteProjectDir);

      expect(envVars.VITE_API_URL).toBe('https://api.vite.example.com');
      expect(envVars.VITE_CDN_URL).toBe('https://cdn.vite.example.com');
      expect(envVars.VITE_APP_NAME).toBe('Test Vite App');
      expect(envVars.REACT_APP_MIXED).toBe('mixed-value'); // Mixed support
    });

    it('should prioritize VITE variables over REACT_APP in VITE projects', () => {
      createViteProject();

      // Add both VITE and REACT_APP versions of same variable
      const envContent = `VITE_API_URL=https://vite.api.com
REACT_APP_API_URL=https://react.api.com`;
      fs.writeFileSync(path.join(viteProjectDir, '.env'), envContent);

      const envVars = CSPInjector.loadEnvironmentVariables(viteProjectDir);

      expect(envVars.VITE_API_URL).toBe('https://vite.api.com');
      expect(envVars.REACT_APP_API_URL).toBe('https://react.api.com');
    });
  });

  describe('VITE HTML Detection', () => {
    it('should detect VITE development HTML (root index.html)', () => {
      createViteProject();

      // Change to project directory for auto-detection
      const originalCwd = process.cwd();
      process.chdir(viteProjectDir);

      try {
        const htmlResult = CSPInjector.detectHTML(true); // dev mode

        expect(htmlResult).toBeTruthy();
        expect(htmlResult?.path).toContain('index.html');
        expect(htmlResult?.buildDir).toBe('.');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should detect VITE production HTML (dist/index.html)', () => {
      createViteProject();

      // Change to project directory for auto-detection
      const originalCwd = process.cwd();
      process.chdir(viteProjectDir);

      try {
        const htmlResult = CSPInjector.detectHTML(false); // prod mode

        expect(htmlResult).toBeTruthy();
        expect(htmlResult?.path).toContain('dist/index.html');
        expect(htmlResult?.buildDir).toBe('dist');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('VITE CSP Injection', () => {
    it('should inject CSP with resolved VITE variables in development mode', () => {
      createViteProject();

      const result = CSPInjector.inject({
        htmlPath: path.join(viteProjectDir, 'index.html'),
        configPath: path.join(viteProjectDir, 'csp.config.json'),
        devMode: true,
      });

      expect(result.htmlPath).toContain('index.html');
      expect(result.cspString).toContain('https://api.vite.example.com');
      expect(result.cspString).toContain('https://cdn.vite.example.com');
      expect(result.nonce).toBeTruthy();
      expect(result.envVars?.VITE_API_URL).toBe('https://api.vite.example.com');

      // Verify HTML content
      const htmlContent = fs.readFileSync(path.join(viteProjectDir, 'index.html'), 'utf-8');
      expect(htmlContent).toContain('Content-Security-Policy');
      expect(htmlContent).toContain('https://api.vite.example.com');
      expect(htmlContent).toContain('https://cdn.vite.example.com');
    });

    it('should inject CSP with resolved VITE variables in production mode', () => {
      createViteProject();

      const result = CSPInjector.inject({
        htmlPath: path.join(viteProjectDir, 'dist', 'index.html'),
        configPath: path.join(viteProjectDir, 'csp.config.json'),
        devMode: false,
      });

      expect(result.htmlPath).toContain('dist/index.html');
      expect(result.cspString).toContain('https://api.vite.example.com');
      expect(result.nonce).toBeTruthy();

      // Verify HTML content
      const htmlContent = fs.readFileSync(path.join(viteProjectDir, 'dist', 'index.html'), 'utf-8');
      expect(htmlContent).toContain('Content-Security-Policy');
      expect(htmlContent).toContain('https://api.vite.example.com');
      expect(htmlContent).not.toContain('{{VITE_API_URL}}'); // Should be resolved
    });

    it('should handle VITE projects without environment variables', () => {
      createViteProject(false, true); // No env, with config

      const result = CSPInjector.inject({
        htmlPath: path.join(viteProjectDir, 'dist', 'index.html'),
        configPath: path.join(viteProjectDir, 'csp.config.json'),
      });

      expect(result.cspString).toContain('{{VITE_API_URL}}'); // Unresolved
      expect(result.envVars).toBeTruthy();
    });

    it('should work with default config for VITE projects', () => {
      createViteProject(true, false); // With env, no config

      const result = CSPInjector.inject({
        htmlPath: path.join(viteProjectDir, 'dist', 'index.html'),
      });

      expect(result.cspString).toContain("'self'");
      expect(result.htmlPath).toContain('dist/index.html');
    });

    it('should handle missing config file', () => {
      createViteProject(true, false); // With env, no config

      const result = CSPInjector.inject({
        htmlPath: path.join(viteProjectDir, 'dist', 'index.html'),
        devMode: false,
        envVars: CSPInjector.loadEnvironmentVariables(viteProjectDir), // Load env vars from project
      });

      expect(result.cspString).toBeTruthy();
      expect(result.envVars?.VITE_API_URL).toBe('https://api.vite.example.com');
    });
  });

  describe('VITE Auto-Detection Integration', () => {
    it('should auto-detect VITE project and inject CSP', () => {
      createViteProject();

      const originalCwd = process.cwd();
      process.chdir(viteProjectDir);

      try {
        const result = CSPInjector.inject({ devMode: false });

        expect(result.htmlPath).toContain('dist/index.html');
        expect(result.cspString).toContain('https://api.vite.example.com');
        expect(result.envVars?.VITE_API_URL).toBe('https://api.vite.example.com');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should auto-detect VITE development setup', () => {
      createViteProject();

      const originalCwd = process.cwd();
      process.chdir(viteProjectDir);

      try {
        const result = CSPInjector.inject({ devMode: true });

        expect(result.htmlPath).toContain('index.html');
        expect(result.htmlPath).not.toContain('dist');
        expect(result.cspString).toContain('https://api.vite.example.com');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('VITE Mixed Environment Support', () => {
    it('should support both VITE and REACT_APP variables in same project', () => {
      createViteProject();

      // Create mixed config
      const mixedConfig = {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", '{{VITE_API_URL}}', '{{REACT_APP_MIXED}}'],
          'connect-src': ["'self'", '{{VITE_API_URL}}'],
          'img-src': ["'self'", 'data:', '{{VITE_CDN_URL}}'],
        },
        useNonce: false,
      };
      fs.writeFileSync(
        path.join(viteProjectDir, 'csp-mixed.config.json'),
        JSON.stringify(mixedConfig, null, 2)
      );

      const result = CSPInjector.inject({
        htmlPath: path.join(viteProjectDir, 'dist', 'index.html'),
        configPath: path.join(viteProjectDir, 'csp-mixed.config.json'),
      });

      expect(result.cspString).toContain('https://api.vite.example.com'); // VITE
      expect(result.cspString).toContain('mixed-value'); // REACT_APP
      expect(result.envVars?.VITE_API_URL).toBe('https://api.vite.example.com');
      expect(result.envVars?.REACT_APP_MIXED).toBe('mixed-value');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing VITE environment file gracefully', () => {
      createViteProject(false, true); // No env, with config

      const envVars = CSPInjector.loadEnvironmentVariables(viteProjectDir);

      // Should still work, just without VITE environment variables
      expect(envVars).toBeDefined();
      expect(envVars.VITE_API_URL).toBeUndefined();
    });

    it('should handle invalid HTML file path', () => {
      expect(() => {
        CSPInjector.inject({
          htmlPath: path.join(viteProjectDir, 'nonexistent.html'),
        });
      }).toThrow('HTML file not found');
    });
  });

  describe('CLI Init Command Integration', () => {
    it('should work with init-generated config for VITE projects', () => {
      createViteProject(true, false); // With env, no config

      // Simulate init command config
      const initConfig = {
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

      const configPath = path.join(viteProjectDir, 'csp.config.json');
      fs.writeFileSync(configPath, JSON.stringify(initConfig, null, 2));

      const result = CSPInjector.inject({
        htmlPath: path.join(viteProjectDir, 'dist', 'index.html'),
        configPath,
      });

      expect(result.cspString).toContain("default-src 'self'");
      expect(result.cspString).toContain("script-src 'self' 'unsafe-inline'");
      expect(result.nonce).toBeUndefined(); // useNonce: false
    });

    it('should support environment variable templates in init config', () => {
      createViteProject(true, false); // With env, no config

      // Simulate init config with environment variable templates
      const initConfig = {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", '{{VITE_API_URL}}'],
          'connect-src': ["'self'", '{{VITE_API_URL}}'],
          'img-src': ["'self'", 'data:', '{{VITE_CDN_URL}}'],
        },
        useNonce: false,
      };

      const configPath = path.join(viteProjectDir, 'csp.config.json');
      fs.writeFileSync(configPath, JSON.stringify(initConfig, null, 2));

      const result = CSPInjector.inject({
        htmlPath: path.join(viteProjectDir, 'dist', 'index.html'),
        configPath,
      });

      expect(result.cspString).toContain('https://api.vite.example.com');
      expect(result.cspString).toContain('https://cdn.vite.example.com');
      expect(result.cspString).not.toContain('{{VITE_API_URL}}'); // Should be resolved
    });
  });
});
