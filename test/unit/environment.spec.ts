/**
 * Unit tests for environment utilities
 */

import * as fs from 'fs';
import {
  parseEnvFile,
  loadReactEnv,
  parseAngularEnvFile,
  isAngularProject,
  isReactProject,
  getFrameworkEnvironmentVariables,
  resolveTemplateVariables,
} from '../../src/utils/environment';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('Environment Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { NODE_ENV: 'test' };
  });

  describe('parseEnvFile', () => {
    it('should parse React environment variables', () => {
      const envContent = `
REACT_APP_API_URL=https://api.example.com
REACT_APP_CDN_URL="https://cdn.example.com"
# Comment should be ignored
SOME_OTHER_VAR=ignored
REACT_APP_EMPTY_VALUE=
`;
      mockFs.readFileSync.mockReturnValue(envContent);
      mockFs.existsSync.mockReturnValue(true);

      const result = parseEnvFile('/test/.env', 'REACT_APP_');

      expect(result).toEqual({
        REACT_APP_API_URL: 'https://api.example.com',
        REACT_APP_CDN_URL: 'https://cdn.example.com',
        REACT_APP_EMPTY_VALUE: '',
      });
    });

    it('should parse VITE environment variables', () => {
      const envContent = `
VITE_API_URL=https://api.vite.com
VITE_APP_NAME='My App'
OTHER_VAR=ignored
`;
      mockFs.readFileSync.mockReturnValue(envContent);

      const result = parseEnvFile('/test/.env', 'VITE_');

      expect(result).toEqual({
        VITE_API_URL: 'https://api.vite.com',
        VITE_APP_NAME: 'My App',
      });
    });

    it('should handle file read errors gracefully', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const result = parseEnvFile('/invalid/.env', 'REACT_APP_');

      expect(result).toEqual({});
    });
  });

  describe('loadReactEnv', () => {
    it('should load React environment variables in correct precedence', () => {
      mockFs.existsSync.mockImplementation(filePath => {
        const pathStr = filePath.toString();
        return pathStr.endsWith('/.env.local') || pathStr.endsWith('/.env');
      });

      mockFs.readFileSync.mockImplementation(filePath => {
        const pathStr = filePath.toString();
        if (pathStr.endsWith('/.env.local')) {
          return 'REACT_APP_API_URL=https://local.api.com\nVITE_LOCAL=true';
        }
        if (pathStr.endsWith('/.env')) {
          return 'REACT_APP_API_URL=https://api.com\nVITE_DEFAULT=true';
        }
        return '';
      });

      // Mock process.env
      process.env.REACT_APP_GLOBAL = 'global';
      process.env.VITE_GLOBAL = 'vite-global';
      process.env.OTHER_VAR = 'ignored';

      const result = loadReactEnv('/test');

      expect(result).toMatchObject({
        REACT_APP_API_URL: 'https://local.api.com', // .env.local takes precedence
        VITE_LOCAL: 'true',
        VITE_DEFAULT: 'true',
        REACT_APP_GLOBAL: 'global',
        VITE_GLOBAL: 'vite-global',
      });

      expect(result.OTHER_VAR).toBeUndefined();
    });
  });

  describe('parseAngularEnvFile', () => {
    it('should parse Angular environment file', () => {
      const angularEnvContent = `
export const environment = {
  production: false,
  apiUrl: 'https://api.dev.com',
  appName: 'Test App',
  version: '1.0.0'
};
`;
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(angularEnvContent);

      const result = parseAngularEnvFile('/test/environment.ts');

      expect(result).toEqual({
        NG_API_URL: 'https://api.dev.com',
        NG_APP_NAME: 'Test App',
        NG_VERSION: '1.0.0',
      });
    });

    it('should handle invalid Angular environment file', () => {
      const invalidContent = 'invalid content';
      mockFs.readFileSync.mockReturnValue(invalidContent);

      const result = parseAngularEnvFile('/test/environment.ts');

      expect(result).toEqual({});
    });

    it('should handle file read errors', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const result = parseAngularEnvFile('/test/environment.ts');

      expect(result).toEqual({});
    });
  });

  describe('isReactProject', () => {
    it('should detect React project from dependencies', () => {
      const packageJson = {
        dependencies: { react: '^18.0.0' },
        devDependencies: {},
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(packageJson));

      const result = isReactProject('/test');

      expect(result).toBe(true);
    });

    it('should detect React project from devDependencies', () => {
      const packageJson = {
        dependencies: {},
        devDependencies: { '@types/react': '^18.0.0' },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(packageJson));

      const result = isReactProject('/test');

      expect(result).toBe(true);
    });

    it('should return false for non-React project', () => {
      const packageJson = {
        dependencies: { express: '^4.0.0' },
        devDependencies: {},
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(packageJson));

      const result = isReactProject('/test');

      expect(result).toBe(false);
    });

    it('should return false when package.json does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = isReactProject('/test');

      expect(result).toBe(false);
    });
  });

  describe('isAngularProject', () => {
    it('should detect Angular project', () => {
      mockFs.existsSync.mockReturnValue(true);

      const result = isAngularProject('/test');

      expect(result).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledWith('/test/angular.json');
    });

    it('should return false for non-Angular project', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = isAngularProject('/test');

      expect(result).toBe(false);
    });
  });

  describe('getFrameworkEnvironmentVariables', () => {
    it('should filter framework-specific variables', () => {
      const envVars = {
        REACT_APP_API_URL: 'https://api.com',
        VITE_CDN_URL: 'https://cdn.com',
        NG_API_URL: 'https://ng.api.com',
        NODE_ENV: 'test',
        PATH: '/usr/bin',
        SOME_OTHER_VAR: 'value',
      };

      const result = getFrameworkEnvironmentVariables(envVars);

      expect(result).toEqual(['REACT_APP_API_URL', 'VITE_CDN_URL', 'NG_API_URL']);
    });

    it('should return empty array when no framework variables', () => {
      const envVars = {
        NODE_ENV: 'test',
        PATH: '/usr/bin',
      };

      const result = getFrameworkEnvironmentVariables(envVars);

      expect(result).toEqual([]);
    });
  });

  describe('resolveTemplateVariables', () => {
    it('should resolve template variables', () => {
      const template = 'https://{{API_URL}}/api/{{VERSION}}';
      const envVars = {
        API_URL: 'api.example.com',
        VERSION: 'v1',
        UNUSED_VAR: 'unused',
      };

      const result = resolveTemplateVariables(template, envVars);

      expect(result).toBe('https://api.example.com/api/v1');
    });

    it('should leave unresolved variables unchanged', () => {
      const template = 'https://{{API_URL}}/api/{{MISSING_VAR}}';
      const envVars = {
        API_URL: 'api.example.com',
      };

      const result = resolveTemplateVariables(template, envVars);

      expect(result).toBe('https://api.example.com/api/{{MISSING_VAR}}');
    });

    it('should handle empty environment variables', () => {
      const template = 'https://{{API_URL}}/api';
      const envVars = {};

      const result = resolveTemplateVariables(template, envVars);

      expect(result).toBe('https://{{API_URL}}/api');
    });

    it('should handle templates without variables', () => {
      const template = 'https://api.example.com/api';
      const envVars = { API_URL: 'test.com' };

      const result = resolveTemplateVariables(template, envVars);

      expect(result).toBe('https://api.example.com/api');
    });
  });
});
