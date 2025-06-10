/**
 * Test utilities and helpers
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface TestProject {
  type: 'react-cra' | 'react-vite' | 'angular' | 'angular-workspace';
  name: string;
  directory: string;
  hasEnvironmentFile: boolean;
  hasConfigFile: boolean;
}

export class TestProjectBuilder {
  private readonly tempDir: string;
  private readonly projectDir: string;
  private readonly projectType: TestProject['type'];

  constructor(projectType: TestProject['type'], projectName = 'test-project') {
    this.projectType = projectType;
    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `csp-test-${projectType}-`));
    this.projectDir = path.join(this.tempDir, projectName);
    fs.mkdirSync(this.projectDir, { recursive: true });
  }

  public withEnvironmentVariables(envVars: Record<string, string>): this {
    const envContent = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    fs.writeFileSync(path.join(this.projectDir, '.env'), envContent);
    return this;
  }

  public withCSPConfig(config: any): this {
    fs.writeFileSync(
      path.join(this.projectDir, 'csp.config.json'),
      JSON.stringify(config, null, 2)
    );
    return this;
  }

  public build(): TestProject {
    this.createPackageJson();
    this.createDefaultHTML();

    if (this.projectType.includes('angular')) {
      this.createAngularJson();
    }

    return {
      type: this.projectType,
      name: path.basename(this.projectDir),
      directory: this.projectDir,
      hasEnvironmentFile: fs.existsSync(path.join(this.projectDir, '.env')),
      hasConfigFile: fs.existsSync(path.join(this.projectDir, 'csp.config.json')),
    };
  }

  public cleanup(): void {
    if (fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    }
  }

  private createPackageJson(): void {
    let packageJson: any;

    switch (this.projectType) {
      case 'react-cra':
        packageJson = {
          name: 'test-react-cra',
          dependencies: {
            react: '^18.0.0',
            'react-scripts': '^5.0.0',
          },
        };
        break;
      case 'react-vite':
        packageJson = {
          name: 'test-react-vite',
          dependencies: {
            react: '^18.0.0',
            vite: '^4.0.0',
          },
        };
        break;
      case 'angular':
        packageJson = {
          name: 'test-angular',
          dependencies: {
            '@angular/core': '^16.0.0',
            '@angular/cli': '^16.0.0',
          },
        };
        break;
      case 'angular-workspace':
        packageJson = {
          name: 'test-angular-workspace',
          dependencies: {
            '@angular/core': '^16.0.0',
            '@angular/cli': '^16.0.0',
          },
        };
        break;
    }

    fs.writeFileSync(
      path.join(this.projectDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  }

  private createDefaultHTML(): void {
    const basicHTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Test App</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

    switch (this.projectType) {
      case 'react-cra':
        // CRA uses public/index.html
        fs.mkdirSync(path.join(this.projectDir, 'public'), { recursive: true });
        fs.mkdirSync(path.join(this.projectDir, 'build'), { recursive: true });
        fs.writeFileSync(path.join(this.projectDir, 'public', 'index.html'), basicHTML);
        fs.writeFileSync(path.join(this.projectDir, 'build', 'index.html'), basicHTML);
        break;
      case 'react-vite':
        // Vite uses root index.html
        fs.mkdirSync(path.join(this.projectDir, 'dist'), { recursive: true });
        fs.writeFileSync(path.join(this.projectDir, 'index.html'), basicHTML);
        fs.writeFileSync(path.join(this.projectDir, 'dist', 'index.html'), basicHTML);
        break;
      case 'angular':
        // Angular uses src/index.html
        fs.mkdirSync(path.join(this.projectDir, 'src'), { recursive: true });
        fs.mkdirSync(path.join(this.projectDir, 'dist', 'test-angular'), { recursive: true });
        fs.writeFileSync(path.join(this.projectDir, 'src', 'index.html'), basicHTML);
        fs.writeFileSync(
          path.join(this.projectDir, 'dist', 'test-angular', 'index.html'),
          basicHTML
        );
        break;
      case 'angular-workspace':
        // Angular workspace
        fs.mkdirSync(path.join(this.projectDir, 'projects', 'app1', 'src'), { recursive: true });
        fs.mkdirSync(path.join(this.projectDir, 'dist', 'app1'), { recursive: true });
        fs.writeFileSync(
          path.join(this.projectDir, 'projects', 'app1', 'src', 'index.html'),
          basicHTML
        );
        fs.writeFileSync(path.join(this.projectDir, 'dist', 'app1', 'index.html'), basicHTML);
        break;
    }
  }

  private createAngularJson(): void {
    let angularJson: any = {
      version: 1,
      projects: {
        'test-angular': {
          architect: {
            build: {
              options: {
                outputPath: 'dist/test-angular',
              },
            },
          },
        },
      },
    };

    if (this.projectType === 'angular-workspace') {
      angularJson = {
        version: 1,
        projects: {
          app1: {
            architect: {
              build: {
                options: {
                  outputPath: 'dist/app1',
                },
              },
            },
          },
        },
      };
    }

    fs.writeFileSync(
      path.join(this.projectDir, 'angular.json'),
      JSON.stringify(angularJson, null, 2)
    );
  }
}

/**
 * Common test constants
 */
export const TEST_CONSTANTS = {
  HTML: {
    BASIC: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Test</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`,
  },
  ENV: {
    REACT: {
      REACT_APP_API_URL: 'https://api.react.example.com',
      REACT_APP_CDN_URL: 'https://cdn.react.example.com',
    },
    VITE: {
      VITE_API_URL: 'https://api.vite.example.com',
      VITE_CDN_URL: 'https://cdn.vite.example.com',
      VITE_APP_NAME: 'Test Vite App',
    },
  },
  CSP: {
    BASIC: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
      },
      useNonce: false,
    },
  },
};
