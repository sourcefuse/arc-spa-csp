import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CSPInjector } from '../../src/csp-injector';

describe('Angular Workspace Environment Loading', () => {
  let tempWorkspaceDir: string;
  let workspaceRootEnvPath: string;
  let workspaceProjectEnvPath: string;
  let workspaceRootHtmlPath: string;
  let workspaceProjectHtmlPath: string;

  beforeEach(() => {
    // Create temporary Angular workspace structure
    tempWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'angular-workspace-test-'));

    // Setup workspace structure
    const workspaceProjectDir = path.join(tempWorkspaceDir, 'projects', 'test-app', 'src');
    const workspaceRootSrcDir = path.join(tempWorkspaceDir, 'src');

    fs.mkdirSync(path.join(workspaceProjectDir, 'environments'), { recursive: true });
    fs.mkdirSync(path.join(workspaceRootSrcDir, 'environments'), { recursive: true });

    // Create environment files
    workspaceRootEnvPath = path.join(workspaceRootSrcDir, 'environments', 'environment.ts');
    workspaceProjectEnvPath = path.join(workspaceProjectDir, 'environments', 'environment.ts');

    // Workspace root environment
    fs.writeFileSync(
      workspaceRootEnvPath,
      `
export const environment = {
  production: false,
  apiUrl: 'https://workspace-root-api.com',
  cdnUrl: 'https://workspace-root-cdn.com',
  feature: 'workspace-root-feature'
};
`
    );

    // Workspace project environment
    fs.writeFileSync(
      workspaceProjectEnvPath,
      `
export const environment = {
  production: false,
  apiUrl: 'https://workspace-project-api.com',
  cdnUrl: 'https://workspace-project-cdn.com',
  feature: 'workspace-project-feature',
  projectSpecific: 'only-in-project'
};
`
    );

    // Create HTML files
    workspaceRootHtmlPath = path.join(workspaceRootSrcDir, 'index.html');
    workspaceProjectHtmlPath = path.join(workspaceProjectDir, 'index.html');

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Test App</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;

    fs.writeFileSync(workspaceRootHtmlPath, htmlContent);
    fs.writeFileSync(workspaceProjectHtmlPath, htmlContent);

    // Create angular.json
    const angularJson = {
      projects: {
        'test-app': {
          architect: {
            build: {
              options: {
                outputPath: 'dist/test-app',
              },
            },
          },
        },
      },
    };

    fs.writeFileSync(
      path.join(tempWorkspaceDir, 'angular.json'),
      JSON.stringify(angularJson, null, 2)
    );
  });

  afterEach(() => {
    // Clean up
    try {
      fs.rmSync(tempWorkspaceDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Environment Variable Loading', () => {
    it('should load workspace root environment when targeting workspace root HTML', () => {
      const originalCwd = process.cwd();
      process.chdir(tempWorkspaceDir);

      try {
        const result = CSPInjector.inject({
          htmlPath: 'src/index.html',
          devMode: true,
        });

        // Should load workspace root environment variables
        expect(result.envVars?.NG_API_URL).toBe('https://workspace-root-api.com');
        expect(result.envVars?.NG_CDN_URL).toBe('https://workspace-root-cdn.com');
        expect(result.envVars?.NG_FEATURE).toBe('workspace-root-feature');
        expect(result.envVars?.NG_PROJECT_SPECIFIC).toBeUndefined();

        expect(result.htmlPath).toContain('src/index.html');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should load workspace project environment when targeting workspace project HTML', () => {
      const originalCwd = process.cwd();
      process.chdir(tempWorkspaceDir);

      try {
        const result = CSPInjector.inject({
          htmlPath: 'projects/test-app/src/index.html',
          devMode: true,
        });

        // Should load workspace project environment variables
        expect(result.envVars?.NG_API_URL).toBe('https://workspace-project-api.com');
        expect(result.envVars?.NG_CDN_URL).toBe('https://workspace-project-cdn.com');
        expect(result.envVars?.NG_FEATURE).toBe('workspace-project-feature');
        expect(result.envVars?.NG_PROJECT_SPECIFIC).toBe('only-in-project');

        expect(result.htmlPath).toContain('projects/test-app/src/index.html');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should prioritize workspace project when auto-detecting HTML files', () => {
      const originalCwd = process.cwd();
      process.chdir(tempWorkspaceDir);

      try {
        // Auto-detection should now find workspace project first (due to search path priority)
        const result = CSPInjector.inject({
          devMode: true,
        });

        // Should load workspace project environment variables (not workspace root)
        expect(result.envVars?.NG_API_URL).toBe('https://workspace-project-api.com');
        expect(result.envVars?.NG_PROJECT_SPECIFIC).toBe('only-in-project');

        expect(result.htmlPath).toContain('projects/test-app/src/index.html');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should inject correct environment variables into CSP', () => {
      const originalCwd = process.cwd();
      process.chdir(tempWorkspaceDir);

      try {
        const result = CSPInjector.inject({
          htmlPath: 'projects/test-app/src/index.html',
          devMode: true,
        });

        // Verify CSP contains workspace project URLs
        expect(result.cspString).toContain('https://workspace-project-api.com');
        expect(result.cspString).toContain('https://workspace-project-cdn.com');

        // Verify CSP does not contain workspace root URLs
        expect(result.cspString).not.toContain('https://workspace-root-api.com');
        expect(result.cspString).not.toContain('https://workspace-root-cdn.com');

        // Verify HTML file was modified correctly
        const htmlContent = fs.readFileSync(result.htmlPath, 'utf-8');
        expect(htmlContent).toContain('https://workspace-project-api.com');
        expect(htmlContent).toContain('https://workspace-project-cdn.com');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle workspace projects without environment files gracefully', () => {
      const originalCwd = process.cwd();
      process.chdir(tempWorkspaceDir);

      try {
        // Remove project environment files
        fs.rmSync(path.join(tempWorkspaceDir, 'projects', 'test-app', 'src', 'environments'), {
          recursive: true,
          force: true,
        });

        const result = CSPInjector.inject({
          htmlPath: 'projects/test-app/src/index.html',
          devMode: true,
        });

        // Should fall back to workspace root or no Angular variables
        expect(result.htmlPath).toContain('projects/test-app/src/index.html');

        // Should not have project-specific variables
        expect(result.envVars?.NG_PROJECT_SPECIFIC).toBeUndefined();
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should fall back to workspace root when no workspace projects exist', () => {
      const originalCwd = process.cwd();
      process.chdir(tempWorkspaceDir);

      try {
        // Remove projects directory
        fs.rmSync(path.join(tempWorkspaceDir, 'projects'), { recursive: true, force: true });

        const result = CSPInjector.inject({
          devMode: true,
        });

        // Should find workspace root HTML
        expect(result.htmlPath).toContain('src/index.html');
        expect(result.htmlPath).not.toContain('projects');

        // Should load workspace root environment variables
        expect(result.envVars?.NG_API_URL).toBe('https://workspace-root-api.com');
        expect(result.envVars?.NG_FEATURE).toBe('workspace-root-feature');
        expect(result.envVars?.NG_PROJECT_SPECIFIC).toBeUndefined();
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Environment Loading API', () => {
    it('should load different environments from different project roots', () => {
      const originalCwd = process.cwd();
      process.chdir(tempWorkspaceDir);

      try {
        // Load from workspace root
        const workspaceRootEnv = CSPInjector.loadEnvironmentVariables('.');
        expect(workspaceRootEnv.NG_API_URL).toBe('https://workspace-root-api.com');
        expect(workspaceRootEnv.NG_PROJECT_SPECIFIC).toBeUndefined();

        // Load from workspace project
        const workspaceProjectEnv = CSPInjector.loadEnvironmentVariables('./projects/test-app');
        expect(workspaceProjectEnv.NG_API_URL).toBe('https://workspace-project-api.com');
        expect(workspaceProjectEnv.NG_PROJECT_SPECIFIC).toBe('only-in-project');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});
