/**
 * Utility functions for parsing Inscribe blocks
 */

import { startsWithMarker } from '@inscribe/shared';

/**
 * Check if a line contains a FILE: header (case-insensitive)
 */
export function isFileHeader(line: string): boolean {
  return startsWithMarker(line, 'FILE:');
}
