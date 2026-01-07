/**
 * Utility functions for parsing Inscribe blocks
 */

/**
 * Check if a line contains a FILE: directive (case-insensitive)
 */
export function isFileDirective(line: string): boolean {
  return line.trim().toUpperCase().startsWith('FILE:');
}
