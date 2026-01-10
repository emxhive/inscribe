import * as fs from 'fs';
import { ParsedBlock, ValidationError } from '@shared';
import { findAllOccurrences } from '../util/textSearch';

/**
 * Validate range mode anchors
 */
export function validateRangeAnchors(
  block: ParsedBlock,
  filePath: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!block.directives.START) {
    errors.push({
      blockIndex: block.blockIndex,
      file: block.file,
      message: 'MODE: range requires START directive',
    });
  }

  if (!block.directives.END) {
    errors.push({
      blockIndex: block.blockIndex,
      file: block.file,
      message: 'MODE: range requires END directive',
    });
  }

  if (errors.length > 0) {
    return errors;
  }

  // Read file content
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check for SCOPE if provided
  let searchContent = content;
  if (block.directives.SCOPE_START && block.directives.SCOPE_END) {
    const scopeStartMatches = findAllOccurrences(content, block.directives.SCOPE_START);
    const scopeEndMatches = findAllOccurrences(content, block.directives.SCOPE_END);

    if (scopeStartMatches.length === 0) {
      errors.push({
        blockIndex: block.blockIndex,
        file: block.file,
        message: `SCOPE_START anchor not found: "${block.directives.SCOPE_START}"`,
      });
    }

    if (scopeEndMatches.length === 0) {
      errors.push({
        blockIndex: block.blockIndex,
        file: block.file,
        message: `SCOPE_END anchor not found: "${block.directives.SCOPE_END}"`,
      });
    }

    if (scopeStartMatches.length > 1) {
      errors.push({
        blockIndex: block.blockIndex,
        file: block.file,
        message: `SCOPE_START anchor matches multiple times (${scopeStartMatches.length}), must match exactly once`,
      });
    }

    if (scopeEndMatches.length > 1) {
      errors.push({
        blockIndex: block.blockIndex,
        file: block.file,
        message: `SCOPE_END anchor matches multiple times (${scopeEndMatches.length}), must match exactly once`,
      });
    }

    if (errors.length > 0) {
      return errors;
    }

    const scopeStart = scopeStartMatches[0];
    const scopeEndStr = block.directives.SCOPE_END;
    if (!scopeEndStr) {
      // This should never happen due to earlier checks, but for safety
      return errors;
    }
    const scopeEnd = scopeEndMatches[0] + scopeEndStr.length;

    if (scopeStart >= scopeEnd) {
      errors.push({
        blockIndex: block.blockIndex,
        file: block.file,
        message: 'SCOPE_END must come after SCOPE_START',
      });
      return errors;
    }

    searchContent = content.substring(scopeStart, scopeEnd);
  }

  // Validate START and END anchors
  const startAnchor = block.directives.START;
  const endAnchor = block.directives.END;
  
  if (!startAnchor || !endAnchor) {
    // This should never happen due to earlier checks
    return errors;
  }

  const startMatches = findAllOccurrences(searchContent, startAnchor);
  const endMatches = findAllOccurrences(searchContent, endAnchor);

  if (startMatches.length === 0) {
    errors.push({
      blockIndex: block.blockIndex,
      file: block.file,
      message: `START anchor not found: "${block.directives.START}"`,
    });
  }

  if (endMatches.length === 0) {
    errors.push({
      blockIndex: block.blockIndex,
      file: block.file,
      message: `END anchor not found: "${block.directives.END}"`,
    });
  }

  if (startMatches.length > 1) {
    errors.push({
      blockIndex: block.blockIndex,
      file: block.file,
      message: `START anchor matches multiple times (${startMatches.length}), must match exactly once`,
    });
  }

  if (endMatches.length > 1) {
    errors.push({
      blockIndex: block.blockIndex,
      file: block.file,
      message: `END anchor matches multiple times (${endMatches.length}), must match exactly once`,
    });
  }

  if (errors.length > 0) {
    return errors;
  }

  const startPos = startMatches[0];
  const endPos = endMatches[0];

  if (startPos >= endPos) {
    errors.push({
      blockIndex: block.blockIndex,
      file: block.file,
      message: 'END anchor must come after START anchor',
    });
  }

  return errors;
}
