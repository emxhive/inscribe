import * as fs from 'fs';

import {ParsedBlock, ValidationError} from "@inscribe/shared";
import { resolveRangeTarget } from '../target/resolveRangeTarget';

export function validateRangeAnchors(
  block: ParsedBlock,
  filePath: string
): ValidationError[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  try {
    resolveRangeTarget(content, block.directives ?? {});
    return [];
  } catch (error) {
    return [
      {
        blockIndex: block.blockIndex,
        file: block.file,
        message: error instanceof Error ? error.message : 'Invalid range anchors',
      },
    ];
  }
}
