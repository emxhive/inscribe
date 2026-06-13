import { isExactV2MarkerLine } from '@inscribe/shared';

export type InscribeProtocol = 'v1' | 'v2';

/**
 * Detects whether the raw input uses the V1 or V2 Inscribe protocol format.
 * A V2 protocol format is detected if any exact trimmed line is one of the reserved V2 markers.
 */
export function detectInscribeProtocol(rawInput: string): InscribeProtocol {
  const lines = rawInput.split(/\r\n|\n|\r/);
  for (const line of lines) {
    if (isExactV2MarkerLine(line)) {
      return 'v2';
    }
  }
  return 'v1';
}
