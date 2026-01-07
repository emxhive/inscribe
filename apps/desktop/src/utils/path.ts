/**
 * Path manipulation utilities
 */

/**
 * Normalize path to use forward slashes
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * Get the last segment of a path (basename)
 */
export function getPathBasename(path: string): string {
  const normalized = normalizePath(path);
  const segments = normalized.split('/').filter(Boolean);
  return segments[segments.length - 1] || '';
}
