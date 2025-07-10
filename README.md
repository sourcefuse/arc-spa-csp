# 🛡️ arc-spa-csp

> Content Security Policy (CSP) injector for Single Page Applications (SPAs) - React, Angular, and VITE projects with comprehensive framework support

[![npm version](https://badge.fury.io/js/arc-spa-csp.svg)](https://www.npmjs.com/package/arc-spa-csp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Coverage](https://img.shields.io/badge/Coverage-74%25-orange.svg)](https://github.com/sourcefuse/arc-spa-csp)
[![Tests](https://img.shields.io/badge/Tests-109%20Passing-brightgreen.svg)](https://github.com/sourcefuse/arc-spa-csp)
[![Node.js](https://img.shields.io/badge/Node.js-16%2B-green.svg)](https://nodejs.org/)

## ✨ Features

- 🎯 **Smart Auto-detection**: Automatically finds HTML files for React, Angular, VITE, and workspace projects
- 📦 **Zero Runtime Dependencies**: Pure TypeScript with minimal external dependencies
- ⚙️ **Intelligent Defaults**: Works out-of-the-box with framework-specific CSP policies
- 🔧 **Environment Aware**: Separate development and production configurations
- 📄 **Maximum Flexibility**: Supports custom HTML and config file paths
- 🔐 **Production Ready**: Secure CSP policies with cryptographic nonce support
- 🌍 **Template Variables**: Dynamic interpolation with {{REACT_APP_*}}, {{VITE_*}}, and {{NG_*}}
- 🚀 **Full VITE Support**: Complete VITE environment variable integration
- 🏗️ **Angular Workspace**: Native support for Angular workspace projects with proper environment isolation

## 🚀 Quick Start

### Installation

```bash
npm install -g arc-spa-csp
# or
npx arc-spa-csp init  # Create default config
```

### Development Mode (No Build Required)

#### React Projects

```bash
# Inject CSP into public/index.html (used by React dev server)
arc-spa-csp --dev
```

#### VITE Projects

```bash
# Inject CSP into index.html (used by VITE dev server)
arc-spa-csp --dev
```

#### Angular Projects

```bash
# Inject CSP into src/index.html (used by ng serve)
arc-spa-csp --dev
```

#### Angular Workspaces

```bash
# Auto-detects projects/*/src/index.html (e.g., projects/arc/src/index.html)
arc-spa-csp --dev

# Or specify explicitly:
arc-spa-csp --dev --html projects/arc/src/index.html
```

### Production Mode (After Build)

```bash
# For React (after npm run build)
npm run build
arc-spa-csp

# For VITE (after npm run build)
npm run build
arc-spa-csp

# For Angular (after ng build)
ng build
arc-spa-csp

# Custom HTML file
arc-spa-csp --html dist/my-app/index.html
```

## 🛠️ CLI Commands

### Initialize Configuration

```bash
# Create default csp.config.json
arc-spa-csp init

# Interactive configuration wizard (recommended)
arc-spa-csp init --interactive

# Use with npx (no installation)
npx arc-spa-csp init --interactive
```

#### 🧙‍♂️ Interactive Configuration Wizard

The interactive mode guides you through creating the perfect CSP configuration for your project:

```bash
arc-spa-csp init --interactive
```

#### Features

- 🚀 Framework Detection: Choose from React CRA, VITE, Angular CLI, or Generic
- ⚙️ Configuration Type: Development (permissive) or Production (strict)
- 🔐 Security Options: Enable nonce support for enhanced security
- 🌍 Environment Variables: Auto-include framework-specific variable templates
- 📊 Report Mode: Option for report-only CSP (logs without blocking)

#### Example Interactive Session

```text
🎉 Welcome to arc-spa-csp configuration wizard!
Let's set up your Content Security Policy configuration.

🚀 Which framework are you using?
  1. React (Create React App) - Traditional React with Create React App
  2. VITE (React/Vue/Vanilla) - Modern build tool with fast HMR
  3. Angular CLI - Angular framework with CLI
  4. Generic/Other - Other frameworks or custom setup

Select framework (1-4): 2
✅ Selected: VITE (React/Vue/Vanilla)

⚙️ Configuration type:
  1. Development (permissive, good for testing)
  2. Production (strict, secure for deployment)
  3. Custom (configure directives manually)

Select type (1-3): 1
✅ Configuration type: development

🔐 Enable nonce for inline scripts/styles? (recommended for production) [y/N]: n

❓ Use report-only mode? (logs violations without blocking) [y/N]: n

🌍 Include VITE_* environment variable templates? [Y/n]: y

⚙️ Configuration summary:
  Framework: vite
  Type: development
  Nonce: disabled
  Report-only: disabled
  Environment variables: included

⚙️ Created config file: csp.config.json
```

### Inject CSP

```text
USAGE:
  arc-spa-csp [options]

COMMANDS:
  init                         Create default csp.config.json file
  (no command)                 Inject CSP into HTML file

OPTIONS:
  --html, -h <path>     Path to HTML file (auto-detected if not specified)
  --config, -c <path>   Path to config file (uses defaults if not specified)
  --dev, -d            Development mode (injects into source files)
  --dry-run            Show what would be done without making changes
  --help               Show this help
  --version, -v        Show version

EXAMPLES:
  arc-spa-csp                              # Auto-detect and inject CSP
  arc-spa-csp --dev                        # Development mode (no build required)
  arc-spa-csp --html build/index.html      # Specific HTML file
  arc-spa-csp --config custom.json         # Custom config
  arc-spa-csp --dry-run                    # Preview changes
  arc-spa-csp init                         # Create default config file
```

## 🔄 Development Workflow

### Working with Dev Servers

The `--dev` flag is designed for development workflows where you want to test CSP policies without building your project:

#### React Development

1. Run `arc-spa-csp --dev` - modifies `public/index.html`
2. Start your dev server: `npm start` or `yarn start`
3. The React dev server serves the modified HTML with CSP headers
4. Test your application and iterate on CSP policies

#### VITE Development

1. Run `arc-spa-csp --dev` - modifies `index.html`
2. Start VITE dev server: `npm run dev` or `yarn dev`
3. The VITE dev server serves the modified HTML with CSP headers
4. Test your application with real CSP policies

#### Angular Development

1. Run `arc-spa-csp --dev` - modifies `src/index.html`
2. Start Angular dev server: `ng serve`
3. The Angular dev server serves the modified HTML with CSP headers
4. Test your application and iterate on CSP policies

#### Key Benefits

- ✅ No build required - Test CSP policies immediately
- ✅ Hot reload friendly - CSP persists through dev server reloads
- ✅ Source control safe - Changes are in source files
- ✅ Environment aware - Automatic resolution of development env vars

### Production Deployment

For production, run CSP injection after your build process:

```bash
# React
npm run build
arc-spa-csp

# VITE
npm run build
arc-spa-csp

# Angular
ng build
arc-spa-csp
```

## 📁 Framework Auto-Detection

### ⚛️ React Projects

#### React Development Mode (`--dev`)

- ✅ `public/index.html` (Create React App default)

#### React Production Mode (default)

- ✅ `build/index.html` (Create React App build output)
- ✅ `dist/index.html` (Vite, Webpack builds)

### ⚡ VITE Projects

#### VITE Development Mode (`--dev`)

- ✅ `index.html` (VITE project root)

#### VITE Production Mode (default)

- ✅ `dist/index.html` (VITE build output)

### 🅰️ Angular Projects

#### Angular Development Mode (`--dev`)

- ✅ `src/index.html` (Standard Angular project)
- ✅ `projects/*/src/index.html` (Angular workspace projects)

#### Angular Production Mode (default)

- ✅ `dist/project-name/index.html` (Angular CLI default)
- ✅ `dist/index.html` (Simple builds)
- 🔍 Smart Detection: Reads `angular.json` to find exact build output path

#### 🏗️ Angular Workspace Support

Full support for Angular workspace projects with proper environment isolation.

**How it works**:

```bash
# Workspace root - uses workspace environment
arc-spa-csp --dev --html src/index.html

# Specific project - uses project-specific environment
arc-spa-csp --dev --html projects/my-app/src/index.html
```

**Environment Variable Loading**:

- **Workspace Root**: `src/environments/environment.ts` → `NG_*` variables
- **Workspace Project**: `projects/my-app/src/environments/environment.ts` → `NG_*` variables
- **Automatic Detection**: Detects correct project root from HTML path
- **Environment Isolation**: Each project can have different environment variables

**Example Workspace Structure**:

```
my-workspace/
├── angular.json
├── src/environments/environment.ts          # Workspace root env
└── projects/
    ├── app1/src/environments/environment.ts # App1 specific env
    └── app2/src/environments/environment.ts # App2 specific env
```

**Usage Examples**:

```bash
# Target specific workspace project
arc-spa-csp --dev --html projects/app1/src/index.html

# Auto-detection finds workspace projects
arc-spa-csp --dev  # Searches projects/*/src/index.html automatically

# Different environments for different projects
# app1 uses: NG_APIURL=https://app1-api.com
# app2 uses: NG_APIURL=https://app2-api.com
```

### 🌐 Other Frameworks

While optimized for React, VITE, and Angular, the tool can work with other frameworks that use similar HTML file structures:

- ✅ **Ionic**: `www/index.html`
- ✅ **Vue.js**: `dist/index.html`, `public/index.html` (generic HTML detection)
- ✅ **Generic HTML**: `index.html` (root directory)

_Note: Environment variable support ({{VARIABLE}}) is specific to React, VITE, and Angular projects._

## ⚙️ Configuration

### Quick Setup

```bash
# Create default configuration
arc-spa-csp init

# This creates csp.config.json with sensible defaults
```

### Manual Configuration

Create a `csp.config.json` file in your project root:

```json
{
  "directives": {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"]
  },
  "useNonce": false,
  "reportOnly": false
}
```

### Environment Variable Support

Create dynamic configurations with template variables:

```json
{
  "directives": {
    "script-src": ["'self'", "{{REACT_APP_API_URL}}", "{{VITE_API_URL}}", "{{NG_APIURL}}"],
    "img-src": ["'self'", "data:", "{{REACT_APP_CDN_URL}}", "{{VITE_CDN_URL}}"],
    "connect-src": ["'self'", "{{REACT_APP_API_URL}}", "{{VITE_API_URL}}", "{{NG_APIURL}}"]
  },
  "useNonce": true
}
```

#### React Environment Variables

- ✅ `.env` files (all variants)
- ✅ `REACT_APP_*` prefixed variables
- ✅ Runtime environment variables

#### VITE Environment Variables

- ✅ `.env` files (all variants)
- ✅ `VITE_*` prefixed variables
- ✅ Mixed `REACT_APP_*` and `VITE_*` support in same project
- ✅ Runtime environment variables

#### Angular Environment Variables

- ✅ `src/environments/environment.ts`
- ✅ `src/environments/environment.prod.ts`
- ✅ Automatic `NG_*` prefixed variables

### Built-in Configurations

#### Development (default)

- Permissive CSP with `'unsafe-inline'`
- No nonce required
- Environment variable resolution

#### Production (NODE_ENV=production)

- Stricter CSP policies
- Nonce support enabled
- Enforced (blocking) mode

## 🔧 API Usage

```typescript
import { CSPInjector } from 'arc-spa-csp';

// Simple injection with auto-detection
const result = CSPInjector.inject();

// With custom options
const result = CSPInjector.inject({
  htmlPath: 'dist/index.html',
  configPath: 'custom-csp.json',
  devMode: false,
});

// With custom config and environment variables
const result = CSPInjector.inject({
  config: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'"],
    },
    useNonce: true,
  },
  envVars: {
    REACT_APP_API_URL: 'https://api.example.com',
    VITE_API_URL: 'https://api.example.com',
  },
});

console.log(`CSP injected into ${result.htmlPath}`);
console.log(`Nonce: ${result.nonce}`);
```

## 🛠️ Build Integration

### npm scripts

```json
{
  "scripts": {
    "build": "vite build",
    "build:csp": "npm run build && arc-spa-csp",
    "dev:csp": "arc-spa-csp --dev",
    "csp:init": "arc-spa-csp init --interactive",
    "csp:preview": "arc-spa-csp --dry-run"
  }
}
```

### CI/CD

```yml
- name: Build and inject CSP
  run: |
    npm run build
    arc-spa-csp
```

## 🧪 Examples

### Getting Started

```bash
# 1. Initialize configuration with interactive wizard (recommended)
arc-spa-csp init --interactive

# 2. Follow the guided setup for your framework
# 3. Test your configuration
arc-spa-csp --dry-run

# 4. Apply CSP to your project
arc-spa-csp --dev  # for development
arc-spa-csp        # for production builds
```

#### Why use the interactive wizard?

- ✅ Framework-Specific: Optimized configurations for React, VITE, Angular
- ✅ Best Practices: Built-in security recommendations
- ✅ Environment Ready: Auto-configures variable templates
- ✅ No Guesswork: Guided setup with explanations

### React with Create React App

```bash
# During development
npm start  # serves from public/
arc-spa-csp --dev  # injects CSP into public/index.html

# For production
npm run build  # creates build/
arc-spa-csp  # injects CSP into build/index.html
```

### VITE Projects

```bash
# During development
npm run dev  # serves from root/index.html
arc-spa-csp --dev  # injects CSP into index.html

# For production
npm run build  # creates dist/
arc-spa-csp  # injects CSP into dist/index.html
```

### Angular with CLI

```bash
# During development
ng serve  # serves from src/
arc-spa-csp --dev  # injects CSP into src/index.html

# For production
ng build  # creates dist/my-app/
arc-spa-csp  # auto-detects and injects CSP
```

### Environment-Driven Configuration

```bash
# React project with environment variables
echo "REACT_APP_API_URL=https://api.example.com" > .env.local
arc-spa-csp --config csp-template.json

# VITE project with environment variables
echo "VITE_API_URL=https://api.example.com" > .env.local
arc-spa-csp --config csp-template.json

# Angular project with environment files
NODE_ENV=production arc-spa-csp
```

## 🔧 Troubleshooting

### HTML File Not Found

If auto-detection fails, specify the path explicitly:

```bash
# For React
arc-spa-csp --html build/index.html

# For VITE
arc-spa-csp --html dist/index.html

# For Angular
arc-spa-csp --html dist/my-project/index.html

# For Angular workspace
arc-spa-csp --html projects/my-app/src/index.html
```

### Environment Variables Not Working

1. **React**: Ensure variables have `REACT_APP_` prefix
2. **VITE**: Ensure variables have `VITE_` prefix
3. **Angular**: Check that `environment.ts` files exist in `src/environments/`
4. **Templates**: Verify `{{VARIABLE_NAME}}` syntax in config files

### Supported Environments

- **Node.js**: 16.x, 18.x, 20.x, 21.x
- **npm**: 8.x+
- **Frameworks**: React, Angular, VITE

### Development Setup

```bash
git clone https://github.com/sourcefuse/arc-spa-csp.git
cd arc-spa-csp
npm install
npm run build
npm test
```

## 📝 License

MIT © [SourceFuse](https://github.com/sourcefuse)

---

## 🎯 About SPA (Single Page Applications)

**SPA** stands for **Single Page Application** - a web application that loads a single HTML document and dynamically updates content as the user interacts with the app, without requiring full page reloads. SPAs are commonly built with frameworks like React, Angular, Vue.js, and built with tools like VITE.

This package specializes in securing SPAs by injecting Content Security Policy (CSP) headers that prevent common web vulnerabilities like XSS attacks, ensuring your single-page applications meet enterprise security standards.
