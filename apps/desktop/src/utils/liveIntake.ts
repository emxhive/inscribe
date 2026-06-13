import { detectInscribeProtocol } from './detectInscribeProtocol';
import { parseIntakeStructure } from './intake';
import { scanV2IntakeStructure } from './intakeV2';
import type { IntakeBlock, IntakeLineMeta } from './intake';
import { INSCRIBE_BEGIN, INSCRIBE_END, matchesMarker } from '@inscribe/shared';

export interface LiveIntakeStructure {
  protocol: 'v1' | 'v2';
  blocks: IntakeBlock[];
  lines: IntakeLineMeta[];
  warnings: string[];
}

export function parseLiveIntakeStructure(
  input: string,
  options?: { indexedFileSet?: Set<string> }
): LiveIntakeStructure {
  const protocol = detectInscribeProtocol(input);
  const globalWarnings: string[] = [];

  if (protocol === 'v2') {
    // If V2 input also contains V1 $inscribe markers, add mixed protocol warning
    const rawLines = input.split(/\r\n|\n|\r/);
    const hasV1 = rawLines.some(line => matchesMarker(line, INSCRIBE_BEGIN) || matchesMarker(line, INSCRIBE_END));
    if (hasV1) {
      globalWarnings.push(
        'Mixed V1/V2 intake detected. V1 blocks are ignored while V2 markers are present.'
      );
    }

    const scanResult = scanV2IntakeStructure(input, options);
    return {
      protocol: 'v2',
      blocks: scanResult.blocks,
      lines: scanResult.lines,
      warnings: globalWarnings,
    };
  } else {
    const parseResult = parseIntakeStructure(input, options);
    return {
      protocol: 'v1',
      blocks: parseResult.blocks,
      lines: parseResult.lines,
      warnings: globalWarnings,
    };
  }
}
