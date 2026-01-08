/**
 * Utility functions for parsing Inscribe blocks
 */

import { startsWithMarker } from '@inscribe/shared';

/**
 * Check if a line contains a FILE: directive (case-insensitive)
 */
export function isFileDirective(line: string): boolean {
  return startsWithMarker(line, 'FILE:');
}
