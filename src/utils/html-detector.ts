import * as fs from 'fs';
import * as path from 'path';
import { HTMLDetectionResult } from '../types/csp';
import { safeJsonParse } from './config-loader';

const HTML_SEARCH_PATHS = {
  DEV: ['projects/*/src/index.html', 'src/index.html', 'public/index.html', 'index.html'],
  PROD: [
    'dist/index.html',
    'build/index.html',
    'www/index.html',
    'public/index.html',
    'index.html',
  ],
} as const;

/**
 * Find HTML file in common locations
 */
export function detectHTML(devMode = false): HTMLDetectionResult | null {
  const searchPaths = getHTMLSearchPaths(devMode);

  for (const htmlPath of searchPaths) {
    const result = findHTMLFile(htmlPath);
    if (result) {
      return result;
    }
  }

  return null;
}

/**
 * Get HTML search paths based on mode
 */
function getHTMLSearchPaths(devMode: boolean): string[] {
  if (devMode) {
    return [...HTML_SEARCH_PATHS.DEV];
  }

  return [...getAngularBuildPaths(), 'dist/*/index.html', ...HTML_SEARCH_PATHS.PROD];
}

/**
 * Get Angular-specific build paths from angular.json
 */
function getAngularBuildPaths(): string[] {
  const angularJsonPath = path.resolve(process.cwd(), 'angular.json');
  if (!fs.existsSync(angularJsonPath)) {
    return [];
  }

  const angularJson = safeJsonParse<{
    projects?: Record<
      string,
      {
        architect?: {
          build?: {
            options?: {
              outputPath?: string;
            };
          };
        };
      }
    >;
  }>(fs.readFileSync(angularJsonPath, 'utf-8'));

  if (!angularJson?.projects) {
    return [];
  }

  return Object.values(angularJson.projects)
    .map(project => project?.architect?.build?.options?.outputPath)
    .filter((outputPath): outputPath is string => !!outputPath)
    .map(outputPath => `${outputPath}/index.html`);
}

/**
 * Find HTML file by path (handles glob patterns)
 */
function findHTMLFile(htmlPath: string): HTMLDetectionResult | null {
  if (htmlPath.includes('*')) {
    return searchGlobPattern(htmlPath);
  }

  const fullPath = path.resolve(process.cwd(), htmlPath);
  if (fs.existsSync(fullPath)) {
    return createHTMLDetectionResult(fullPath, htmlPath);
  }

  return null;
}

/**
 * Search for HTML files using glob patterns
 */
function searchGlobPattern(htmlPath: string): HTMLDetectionResult | null {
  const [beforeStar, afterStar] = htmlPath.split('*');

  if (!beforeStar || afterStar === undefined) {
    return null;
  }

  try {
    const searchDir = path.resolve(process.cwd(), beforeStar);
    if (!fs.existsSync(searchDir)) {
      return null;
    }

    const subdirs = fs
      .readdirSync(searchDir)
      .filter(item => fs.statSync(path.join(searchDir, item)).isDirectory());

    for (const subdir of subdirs) {
      const potentialPath = path.join(searchDir, subdir + afterStar);
      if (fs.existsSync(potentialPath)) {
        const relativePath = path.relative(process.cwd(), potentialPath);
        return createHTMLDetectionResult(potentialPath, relativePath);
      }
    }
  } catch {
    // Ignore filesystem errors
  }

  return null;
}

/**
 * Create HTML detection result
 */
function createHTMLDetectionResult(fullPath: string, htmlPath: string): HTMLDetectionResult {
  const content = fs.readFileSync(fullPath, 'utf-8');
  const cspRegex = /^.*<meta\s+[^>]*http-equiv\s*=\s*["']Content-Security-Policy.*$/im;
  const hasExistingCSP = cspRegex.test(content);

  return {
    path: fullPath,
    buildDir: path.dirname(htmlPath),
    hasExistingCSP,
  };
}

/**
 * Process HTML content to inject CSP
 */
export function processHTMLContent(
  html: string,
  csp: string,
  reportOnly: boolean
): { modifiedHtml: string; replacedTags: number } {
  const metaType = reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
  const metaTag = `<meta http-equiv="${metaType}" content="${csp}">`;

  // Remove existing CSP tags and any surrounding whitespace/newlines
  const cspRegex =
    /[\r\n\s]*<meta\s+(?:[^>]*\s+)?http-equiv\s*=\s*["']Content-Security-Policy(?:-Report-Only)?["'][^>]*>[\r\n\s]*/gim;
  let modifiedHtml = html.replace(cspRegex, '');

  // Inject new CSP tag
  modifiedHtml = injectMetaTag(modifiedHtml, metaTag);

  return { modifiedHtml, replacedTags: 1 };
}

/**
 * Inject meta tag into HTML
 */
function injectMetaTag(html: string, metaTag: string): string {
  // Inject new CSP tag after <head>
  const headRegex = /^.*<head[^>]*>.*$/im;
  const headMatch = headRegex.exec(html);
  if (headMatch) {
    return html.replace(/(<head[^>]*>)/i, `$1\n${metaTag}`);
  }

  // Fallback: add at the beginning
  return `${metaTag}\n${html}`;
}

/**
 * Detect Angular workspace root
 */
export function detectAngularWorkspaceRoot(projectRoot: string, htmlPath: string): string {
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
        return workspaceProjectRoot;
      }
    }
  }

  return projectRoot;
}
