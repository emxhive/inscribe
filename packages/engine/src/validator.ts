/**
 * Validator for Inscribe blocks
 * Validates blocks against indexed roots, ignored paths, file existence rules, and range anchors
 */

import * as fs from 'fs';
import * as path from 'path';
import { ParsedBlock, ValidationError } from '@inscribe/shared';
import { getEffectiveIgnorePrefixes, getOrCreateScope } from './repository';

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

/**
 * Validate all blocks against repository rules
 */
export function validateBlocks(
  blocks: ParsedBlock[],
  repoRoot: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const block of blocks) {
    const blockErrors = validateBlock(block, repoRoot);
    errors.push(...blockErrors);
  }

  return errors;
}

/**
 * Validate a single block
 */
function validateBlock(
  block: ParsedBlock,
  repoRoot: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  const normalizedFile = normalizePath(block.file);
  const scopeState = getOrCreateScope(repoRoot);
  const scopeRoots = scopeState.scope;

  // Check if file path is under the current scope roots
  const isInScope = scopeRoots.some((root: string) => normalizedFile.startsWith(root));

  if (!isInScope) {
    errors.push({
      blockIndex: block.blockIndex,
      file: normalizedFile,
      message: `File must be under scope roots: ${scopeRoots.join(', ')}`,
    });
  }

  // Check if file path is in an ignored path
  const ignores = getEffectiveIgnorePrefixes(repoRoot);
  const ignoreMatch = ignores.find(ignored => normalizedFile.startsWith(ignored));

  if (ignoreMatch) {
    errors.push({
      blockIndex: block.blockIndex,
      file: normalizedFile,
      message: `File is ignored by rules: ${ignores.join(', ')}`,
    });
  }

  const filePath = path.join(repoRoot, normalizedFile);
  const fileExists = fs.existsSync(filePath);

  // Mode-specific validation
  switch (block.mode) {
    case 'create':
      if (fileExists) {
        errors.push({
          blockIndex: block.blockIndex,
          file: block.file,
          message: 'File already exists (MODE: create requires non-existing file)',
        });
      }
      break;

    case 'replace':
      if (!fileExists) {
        errors.push({
          blockIndex: block.blockIndex,
          file: block.file,
          message: 'File does not exist (MODE: replace requires existing file)',
        });
      }
      break;

    case 'append':
      if (!fileExists) {
        errors.push({
          blockIndex: block.blockIndex,
          file: block.file,
          message: 'File does not exist (MODE: append requires existing file)',
        });
      }
      break;

    case 'range':
      if (!fileExists) {
        errors.push({
          blockIndex: block.blockIndex,
          file: block.file,
          message: 'File does not exist (MODE: range requires existing file)',
        });
      } else {
        // Validate range anchors
        const rangeErrors = validateRangeAnchors(block, filePath);
        errors.push(...rangeErrors);
      }
      break;
  }

  return errors;
}

/**
 * Validate range mode anchors
 */
function validateRangeAnchors(
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

/**
 * Find all occurrences of a substring
 */
function findAllOccurrences(content: string, search: string): number[] {
  const positions: number[] = [];
  let pos = content.indexOf(search);
  while (pos !== -1) {
    positions.push(pos);
    pos = content.indexOf(search, pos + 1);
  }
  return positions;
}
