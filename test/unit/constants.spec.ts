/**
 * Unit tests for constants module
 */

import {
  ENV_PREFIXES,
  ENVIRONMENT_FILES,
  HTML_SEARCH_PATHS,
  CSP_DIRECTIVES,
  CSP_VALUES,
  BASE_DIRECTIVES,
  NONCE_DEFAULTS,
  REGEX_PATTERNS,
} from '../../src/constants';

describe('Constants', () => {
  describe('ENV_PREFIXES', () => {
    it('should have correct environment prefixes', () => {
      expect(ENV_PREFIXES.REACT).toBe('REACT_APP_');
      expect(ENV_PREFIXES.VITE).toBe('VITE_');
      expect(ENV_PREFIXES.ANGULAR).toBe('NG_');
    });
  });

  describe('ENVIRONMENT_FILES', () => {
    it('should have React environment files in correct order', () => {
      expect(ENVIRONMENT_FILES.REACT).toEqual([
        '.env.local',
        '.env.development.local',
        '.env.production.local',
        '.env.development',
        '.env.production',
        '.env',
      ]);
    });

    it('should have Angular environment files', () => {
      expect(ENVIRONMENT_FILES.ANGULAR.DEV).toBe('environment.ts');
      expect(ENVIRONMENT_FILES.ANGULAR.PROD).toBe('environment.prod.ts');
    });
  });

  describe('HTML_SEARCH_PATHS', () => {
    it('should have correct development paths', () => {
      expect(HTML_SEARCH_PATHS.DEV).toContain('src/index.html');
      expect(HTML_SEARCH_PATHS.DEV).toContain('public/index.html');
      expect(HTML_SEARCH_PATHS.DEV).toContain('index.html');
    });

    it('should have correct production paths', () => {
      expect(HTML_SEARCH_PATHS.PROD).toContain('dist/index.html');
      expect(HTML_SEARCH_PATHS.PROD).toContain('build/index.html');
    });
  });

  describe('CSP_DIRECTIVES', () => {
    it('should have all required CSP directives', () => {
      expect(CSP_DIRECTIVES.DEFAULT_SRC).toBe('default-src');
      expect(CSP_DIRECTIVES.SCRIPT_SRC).toBe('script-src');
      expect(CSP_DIRECTIVES.STYLE_SRC).toBe('style-src');
      expect(CSP_DIRECTIVES.IMG_SRC).toBe('img-src');
      expect(CSP_DIRECTIVES.FONT_SRC).toBe('font-src');
      expect(CSP_DIRECTIVES.CONNECT_SRC).toBe('connect-src');
      expect(CSP_DIRECTIVES.WORKER_SRC).toBe('worker-src');
      expect(CSP_DIRECTIVES.MANIFEST_SRC).toBe('manifest-src');
    });
  });

  describe('CSP_VALUES', () => {
    it('should have correct CSP values', () => {
      expect(CSP_VALUES.SELF).toBe("'self'");
      expect(CSP_VALUES.UNSAFE_INLINE).toBe("'unsafe-inline'");
      expect(CSP_VALUES.DATA).toBe('data:');
      expect(CSP_VALUES.BLOB).toBe('blob:');
    });
  });

  describe('BASE_DIRECTIVES', () => {
    it('should have default-src with self', () => {
      expect(BASE_DIRECTIVES['default-src']).toContain("'self'");
    });

    it('should have style-src with self and unsafe-inline for Angular', () => {
      expect(BASE_DIRECTIVES['style-src']).toContain("'self'");
      expect(BASE_DIRECTIVES['style-src']).toContain("'unsafe-inline'");
    });

    it('should have img-src with data and blob support', () => {
      expect(BASE_DIRECTIVES['img-src']).toContain("'self'");
      expect(BASE_DIRECTIVES['img-src']).toContain('data:');
      expect(BASE_DIRECTIVES['img-src']).toContain('blob:');
    });
  });

  describe('NONCE_DEFAULTS', () => {
    it('should have correct nonce lengths', () => {
      expect(NONCE_DEFAULTS.LENGTH).toBe(16);
      expect(NONCE_DEFAULTS.PRODUCTION_LENGTH).toBe(24);
    });
  });

  describe('REGEX_PATTERNS', () => {
    it('should have valid regex patterns', () => {
      expect(REGEX_PATTERNS.CSP_META_TAG).toBeInstanceOf(RegExp);
      expect(REGEX_PATTERNS.CSP_DETECTION).toBeInstanceOf(RegExp);
      expect(REGEX_PATTERNS.HEAD_TAG).toBeInstanceOf(RegExp);
      expect(REGEX_PATTERNS.TEMPLATE_VARIABLE).toBeInstanceOf(RegExp);
    });

    it('should match CSP meta tags correctly', () => {
      const cspHtml = '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'">';
      expect(REGEX_PATTERNS.CSP_DETECTION.test(cspHtml)).toBe(true);
    });

    it('should match template variables correctly', () => {
      const template = 'https://{{API_URL}}/api';
      const regex = REGEX_PATTERNS.TEMPLATE_VARIABLE;
      const match = regex.exec(template);
      expect(match).toBeTruthy();
      if (match) {
        expect(match[0]).toBe('{{API_URL}}');
        expect(match[1]).toBe('API_URL');
      }
    });
  });
});
