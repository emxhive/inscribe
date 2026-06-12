export type InscribeProtocol = 'v1' | 'v2';

const V2_MARKERS = new Set([
  '<<<INSCRIBE',
  'INSCRIBE>>>',
  '<<<CONTENT',
  'CONTENT>>>',
  '<<<SEARCH',
  'SEARCH>>>',
  '<<<STARTS_WITH',
  'STARTS_WITH>>>',
]);

/**
 * Detects whether the raw input uses the V1 or V2 Inscribe protocol format.
 * A V2 protocol format is detected if any exact trimmed line is one of the reserved V2 markers.
 */
export function detectInscribeProtocol(rawInput: string): InscribeProtocol {
  const lines = rawInput.split(/\r\n|\n|\r/);
  for (const line of lines) {
    if (V2_MARKERS.has(line.trim())) {
      return 'v2';
    }
  }
  return 'v1';
}
