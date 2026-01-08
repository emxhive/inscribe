/**
 * Shared parsing utilities for Inscribe
 * These functions provide case-insensitive, whitespace-tolerant matching
 */

/**
 * Normalize a string for case-insensitive, whitespace-tolerant comparison
 * - Trims leading/trailing whitespace
 * - Converts to uppercase
 * - Normalizes internal whitespace to single spaces
 */
export function normalizeMarker(text: string): string {
  return text.trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Check if a line matches a marker (case-insensitive, whitespace-tolerant)
 */
export function matchesMarker(line: string, marker: string): boolean {
  return normalizeMarker(line) === normalizeMarker(marker);
}

/**
 * Check if a line starts with a marker (case-insensitive, whitespace-tolerant)
 */
export function startsWithMarker(line: string, marker: string): boolean {
  return normalizeMarker(line).startsWith(normalizeMarker(marker));
}

/**
 * Extract the value after a marker (e.g., "FILE: test.js" -> "test.js")
 * Returns the value with original casing and trimmed whitespace
 */
export function extractMarkerValue(line: string, marker: string): string {
  const normalized = normalizeMarker(line);
  const normalizedMarker = normalizeMarker(marker);
  
  if (!normalized.startsWith(normalizedMarker)) {
    return '';
  }
  
  // Find the position where the marker ends in the original string
  // by walking through both strings simultaneously
  let originalPos = 0;
  let normalizedPos = 0;
  const lineNormalized = normalizeMarker(line);
  
  // Skip to the end of the marker in the original string
  while (normalizedPos < normalizedMarker.length && originalPos < line.length) {
    const origChar = line[originalPos].toUpperCase();
    const normChar = lineNormalized[normalizedPos];
    
    if (origChar === normChar || (origChar === ' ' && normChar === ' ')) {
      normalizedPos++;
    }
    originalPos++;
  }
  
  // Return the rest of the string, trimmed
  return line.substring(originalPos).trim();
}
