/**
 * NODE_ENV setup and restoration utilities
 * Handles temporary NODE_ENV changes for different modes (dev/prod)
 */

/**
 * Setup environment for the specified mode
 */
export function setupEnvironmentForMode(devMode?: boolean): boolean {
  if (!process.env['NODE_ENV']) {
    process.env['NODE_ENV'] = devMode === true ? 'development' : 'production';
    return true;
  }

  if (devMode === true && process.env['NODE_ENV'] === 'production') {
    process.env['NODE_ENV'] = 'development';
    return true;
  }

  if (devMode === false && process.env['NODE_ENV'] === 'development') {
    process.env['NODE_ENV'] = 'production';
    return true;
  }

  return false;
}

/**
 * Restore original environment
 */
export function restoreEnvironment(shouldRestore: boolean, originalNodeEnv?: string): void {
  if (shouldRestore) {
    if (originalNodeEnv !== undefined) {
      process.env['NODE_ENV'] = originalNodeEnv;
    } else {
      delete process.env['NODE_ENV'];
    }
  }
}
