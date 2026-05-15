import * as fs from 'fs';

import {ParsedBlock, ValidationError} from "@inscribe/shared";
import { resolveRange } from '../range/resolveRange';


/**
 * Validate range mode anchors
 */
export function validateRangeAnchors(
  block: ParsedBlock,
  filePath: string
): ValidationError[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  try {
    resolveRange(content, block.directives ?? {});
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
