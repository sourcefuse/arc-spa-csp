/**
 * Integration tests for React Create React App (CRA) CSP injection
 * Uses dynamic test fixtures for professional isolation
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CSPInjector } from '../../src/csp-injector';
import { detectProjectType } from '../../src/utils/environment';

describe('React CRA Integration Tests', () => {
  let tempDir: string;
  let craProjectDir: string;

  beforeEach(() => {
    // Create temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csp-react-cra-test-'));
    craProjectDir = path.join(tempDir, 'react-cra-project');
    fs.mkdirSync(craProjectDir);
  });

  afterEach(() => {
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const createReactCRAProject = (withEnv = true, withConfig = true): void => {
    // Create package.json (CRA signature)
    const packageJson = {
      name: 'test-react-cra-project',
      version: '0.1.0',
      dependencies: {
        react: '^18.0.0',
        'react-dom': '^18.0.0',
        'react-scripts': '^5.0.0',
        '@testing-library/jest-dom': '^5.16.0',
        '@testing-library/react': '^13.0.0',
        '@testing-library/user-event': '^13.0.0',
        'web-vitals': '^2.1.0',
      },
      scripts: {
        start: 'react-scripts start',
        build: 'react-scripts build',
        test: 'react-scripts test',
        eject: 'react-scripts eject',
      },
    };
    fs.writeFileSync(
      path.join(craProjectDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create CRA directory structure
    const publicDir = path.join(craProjectDir, 'public');
    const srcDir = path.join(craProjectDir, 'src');
    const buildDir = path.join(craProjectDir, 'build');

    fs.mkdirSync(publicDir);
    fs.mkdirSync(srcDir);
    fs.mkdirSync(buildDir);

    // Create public/index.html (CRA development)
    const publicIndexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="React CRA test app" />
    <title>React CRA App</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>`;
    fs.writeFileSync(path.join(publicDir, 'index.html'), publicIndexHtml);

    // Create build/index.html (CRA production)
    const buildIndexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <link rel="icon" href="/favicon.ico"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <meta name="theme-color" content="#000000"/>
    <meta name="description" content="React CRA test app"/>
    <title>React CRA App</title>
    <script defer="defer" src="/static/js/main.abc123.js"></script>
    <link href="/static/css/main.def456.css" rel="stylesheet">
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>`;
    fs.writeFileSync(path.join(buildDir, 'index.html'), buildIndexHtml);

    // Create src/index.js (CRA entry point)
    const indexJs = `import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
    fs.writeFileSync(path.join(srcDir, 'index.js'), indexJs);

    if (withEnv) {
      // Create .env files with proper CRA precedence
      const envFiles = [
        {
          name: '.env',
          content: 'REACT_APP_API_URL=https://api.example.com\nREACT_APP_GLOBAL=global',
        },
        {
          name: '.env.local',
          content: 'REACT_APP_API_URL=https://local.api.example.com\nREACT_APP_LOCAL=local',
        },
        {
          name: '.env.development',
          content: 'REACT_APP_ENV_MODE=development\nREACT_APP_DEBUG=true',
        },
        {
          name: '.env.production',
          content: 'REACT_APP_ENV_MODE=production\nREACT_APP_DEBUG=false',
        },
      ];

      envFiles.forEach(({ name, content }) => {
        fs.writeFileSync(path.join(craProjectDir, name), content);
      });
    }

    if (withConfig) {
      // Create CSP config with CRA-specific directives
      const cspConfig = {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", '{{REACT_APP_API_URL}}'],
          'connect-src': ["'self'", '{{REACT_APP_API_URL}}'],
          'img-src': ["'self'", 'data:', 'blob:'],
          'style-src': ["'self'", "'unsafe-inline'"], // CRA needs unsafe-inline for styles
          'font-src': ["'self'", 'data:'],
        },
        useNonce: false, // CRA typically doesn't use nonces in dev
      };
      fs.writeFileSync(
        path.join(craProjectDir, 'csp.config.json'),
        JSON.stringify(cspConfig, null, 2)
      );
    }
  };

  describe('React CRA Environment Variable Detection', () => {
    it('should detect CRA project correctly', () => {
      createReactCRAProject();

      const envVars = CSPInjector.loadEnvironmentVariables(craProjectDir);

      expect(envVars.REACT_APP_API_URL).toBe('https://local.api.example.com'); // .env.local takes precedence
      expect(envVars.REACT_APP_GLOBAL).toBe('global');
      expect(envVars.REACT_APP_LOCAL).toBe('local');
    });

    it('should respect CRA environment file precedence', () => {
      createReactCRAProject();

      // Set NODE_ENV to test precedence
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      try {
        const envVars = CSPInjector.loadEnvironmentVariables(craProjectDir);

        // .env.local should override .env
        expect(envVars.REACT_APP_API_URL).toBe('https://local.api.example.com');
        expect(envVars.REACT_APP_ENV_MODE).toBe('development');
        expect(envVars.REACT_APP_DEBUG).toBe('true');
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('should handle production environment correctly', () => {
      createReactCRAProject();

      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const envVars = CSPInjector.loadEnvironmentVariables(craProjectDir);

        expect(envVars.REACT_APP_ENV_MODE).toBe('production');
        expect(envVars.REACT_APP_DEBUG).toBe('false');
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });

  describe('React CRA HTML Detection', () => {
    it('should detect CRA development HTML (public/index.html)', () => {
      createReactCRAProject();

      const originalCwd = process.cwd();
      process.chdir(craProjectDir);

      try {
        const htmlResult = CSPInjector.detectHTML(true); // dev mode

        expect(htmlResult).toBeTruthy();
        expect(htmlResult?.path).toContain('public/index.html');
        expect(htmlResult?.buildDir).toBe('public');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should detect CRA production HTML (build/index.html)', () => {
      createReactCRAProject();

      const originalCwd = process.cwd();
      process.chdir(craProjectDir);

      try {
        const htmlResult = CSPInjector.detectHTML(false); // prod mode

        expect(htmlResult).toBeTruthy();
        expect(htmlResult?.path).toContain('build/index.html');
        expect(htmlResult?.buildDir).toBe('build');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('React CRA CSP Injection', () => {
    it('should inject CSP with resolved REACT_APP variables in development mode', () => {
      createReactCRAProject();

      const result = CSPInjector.inject({
        htmlPath: path.join(craProjectDir, 'public', 'index.html'),
        configPath: path.join(craProjectDir, 'csp.config.json'),
        devMode: true,
      });

      expect(result.htmlPath).toContain('public/index.html');
      expect(result.cspString).toContain('https://local.api.example.com'); // .env.local precedence
      expect(result.envVars?.REACT_APP_API_URL).toBe('https://local.api.example.com');

      // Verify HTML content
      const htmlContent = fs.readFileSync(
        path.join(craProjectDir, 'public', 'index.html'),
        'utf-8'
      );
      expect(htmlContent).toContain('Content-Security-Policy');
      expect(htmlContent).toContain('https://local.api.example.com');
      expect(htmlContent).toContain("'unsafe-inline'"); // CRA needs this for styles
    });

    it('should inject CSP with resolved REACT_APP variables in production mode', () => {
      createReactCRAProject();

      const result = CSPInjector.inject({
        htmlPath: path.join(craProjectDir, 'build', 'index.html'),
        configPath: path.join(craProjectDir, 'csp.config.json'),
        devMode: false,
      });

      expect(result.htmlPath).toContain('build/index.html');
      expect(result.cspString).toContain('https://local.api.example.com');

      // Verify HTML was modified
      const htmlContent = fs.readFileSync(path.join(craProjectDir, 'build', 'index.html'), 'utf-8');
      expect(htmlContent).toContain('Content-Security-Policy');
    });

    it('should handle CRA projects without environment variables gracefully', () => {
      createReactCRAProject(false, true); // no env, with config

      const result = CSPInjector.inject({
        htmlPath: path.join(craProjectDir, 'public', 'index.html'),
        devMode: true,
      });

      expect(result).toBeTruthy();
      expect(result.htmlPath).toBeTruthy();
      expect(result.cspString).not.toContain('{{REACT_APP_');
    });

    it('should work with default config for CRA projects', () => {
      createReactCRAProject(true, false); // with env, no config

      const result = CSPInjector.inject({
        htmlPath: path.join(craProjectDir, 'public', 'index.html'),
        devMode: true,
      });

      expect(result).toBeTruthy();
      expect(result.htmlPath).toBeTruthy();
      expect(result.cspString).toContain("'self'");
      expect(result.cspString).toContain("'unsafe-inline'"); // Default dev config
    });
  });

  describe('React CRA Auto-Detection Integration', () => {
    it('should auto-detect CRA project and inject CSP', () => {
      createReactCRAProject();

      const originalCwd = process.cwd();
      process.chdir(craProjectDir);

      try {
        const result = CSPInjector.inject({
          devMode: true,
        });

        expect(result).toBeTruthy();
        expect(result.htmlPath).toContain('public/index.html');
        expect(result.envVars?.REACT_APP_API_URL).toBe('https://local.api.example.com');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should differentiate CRA from VITE projects', () => {
      createReactCRAProject();

      const projectType = detectProjectType(craProjectDir);

      expect(projectType).toBe('react-cra');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing CRA environment files gracefully', () => {
      createReactCRAProject(false); // no env files

      const envVars = CSPInjector.loadEnvironmentVariables(craProjectDir);

      // Should not have any REACT_APP variables from files, but may have system env vars
      const reactAppVars = Object.keys(envVars).filter(key => key.startsWith('REACT_APP_'));
      expect(reactAppVars.length).toBe(0);
    });

    it('should handle invalid HTML file path', () => {
      createReactCRAProject();

      expect(() => {
        CSPInjector.inject({
          htmlPath: path.join(craProjectDir, 'nonexistent.html'),
          devMode: true,
        });
      }).toThrow();
    });
  });

  describe('Mixed Environment Support', () => {
    it('should handle mixed REACT_APP and system environment variables', () => {
      createReactCRAProject();

      // Set system environment variables
      const originalEnv = process.env.REACT_APP_SYSTEM_VAR;
      process.env.REACT_APP_SYSTEM_VAR = 'system-value';

      try {
        const envVars = CSPInjector.loadEnvironmentVariables(craProjectDir);

        expect(envVars.REACT_APP_SYSTEM_VAR).toBe('system-value');
        expect(envVars.REACT_APP_API_URL).toBe('https://local.api.example.com'); // From .env.local
      } finally {
        if (originalEnv) {
          process.env.REACT_APP_SYSTEM_VAR = originalEnv;
        } else {
          delete process.env.REACT_APP_SYSTEM_VAR;
        }
      }
    });
  });
});
