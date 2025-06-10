import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CSPInjector } from '../../src/csp-injector';

describe('Environment Variable Context Bug Fix', () => {
  let tempDir: string;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csp-env-test-'));
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    // Restore NODE_ENV
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }

    // Clean up temp files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const setupDirectoryStructure = (structure: Record<string, string>): void => {
    Object.entries(structure).forEach(([dir, content]) => {
      const fullPath = path.join(tempDir, dir);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    });
  };

  const setupReactProject = (envFiles: Record<string, string>, htmlPath = 'public/index.html') => {
    const structure = {
      'package.json': JSON.stringify({
        dependencies: { react: '^18.0.0' },
      }),
      [htmlPath]: basicHtml,
      ...envFiles,
    };
    setupDirectoryStructure(structure);
  };

  const basicHtml = `<!DOCTYPE html>
<html><head><title>Test</title></head><body></body></html>`;

  it('should load development variables when devMode=true regardless of NODE_ENV', () => {
    process.env.NODE_ENV = 'production';

    setupReactProject({
      '.env.development': 'REACT_APP_DEV_API=https://dev.api.com',
      '.env.production': 'REACT_APP_PROD_API=https://prod.api.com',
    });

    // Change working directory to temp dir for the test
    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const result = CSPInjector.inject({
        htmlPath: path.join(tempDir, 'public/index.html'),
        devMode: true,
      });

      expect(result.envVars?.REACT_APP_DEV_API).toBe('https://dev.api.com');
      expect(result.envVars?.REACT_APP_PROD_API).toBeUndefined();
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should load production variables when devMode=false', () => {
    process.env.NODE_ENV = 'development';

    setupReactProject({
      '.env.development': 'REACT_APP_DEV_API=https://dev.api.com',
      '.env.production': 'REACT_APP_PROD_API=https://prod.api.com',
    });

    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const result = CSPInjector.inject({
        htmlPath: path.join(tempDir, 'public/index.html'),
        devMode: false,
      });

      expect(result.envVars?.REACT_APP_PROD_API).toBe('https://prod.api.com');
      expect(result.envVars?.REACT_APP_DEV_API).toBeUndefined();
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should default to production when devMode is undefined and NODE_ENV is unset', () => {
    delete process.env.NODE_ENV;

    setupReactProject({
      '.env.development': 'REACT_APP_DEV_API=https://dev.api.com',
      '.env.production': 'REACT_APP_PROD_API=https://prod.api.com',
    });

    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const result = CSPInjector.inject({
        htmlPath: path.join(tempDir, 'public/index.html'),
      });

      expect(result.envVars?.REACT_APP_PROD_API).toBe('https://prod.api.com');
      expect(result.envVars?.REACT_APP_DEV_API).toBeUndefined();
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should properly restore original NODE_ENV after injection', () => {
    const originalValue = 'test-env';
    process.env.NODE_ENV = originalValue;

    setupReactProject({
      '.env.development': 'REACT_APP_DEV_API=https://dev.api.com',
    });

    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      CSPInjector.inject({
        htmlPath: path.join(tempDir, 'public/index.html'),
        devMode: true,
      });

      expect(process.env.NODE_ENV).toBe(originalValue);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should handle environment variable loading with proper NODE_ENV context regardless of prefix', () => {
    process.env.NODE_ENV = 'production';

    setupReactProject({
      '.env.development':
        'REACT_APP_DEV_API=https://dev.api.com\nVITE_DEV_API=https://dev.vite.com',
      '.env.production':
        'REACT_APP_PROD_API=https://prod.api.com\nVITE_PROD_API=https://prod.vite.com',
    });

    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const result = CSPInjector.inject({
        htmlPath: path.join(tempDir, 'public/index.html'),
        devMode: true, // Should load dev variables despite NODE_ENV=production
      });

      expect(result.envVars?.REACT_APP_DEV_API).toBe('https://dev.api.com');
      expect(result.envVars?.REACT_APP_PROD_API).toBeUndefined();
      expect(result.envVars?.VITE_DEV_API).toBe('https://dev.vite.com');
      expect(result.envVars?.VITE_PROD_API).toBeUndefined();
    } finally {
      process.chdir(originalCwd);
    }
  });
});
