import { scanIntakeStructure } from './intakeParser';
import type { IntakeBlock, IntakeLineMeta } from './intake';

export interface LiveIntakeStructure {
  blocks: IntakeBlock[];
  lines: IntakeLineMeta[];
  warnings: string[];
}

export function parseLiveIntakeStructure(
  input: string,
  options?: { indexedFileSet?: Set<string> }
): LiveIntakeStructure {
  const scanResult = scanIntakeStructure(input, options);
  return { blocks: scanResult.blocks, lines: scanResult.lines, warnings: [] };
}
