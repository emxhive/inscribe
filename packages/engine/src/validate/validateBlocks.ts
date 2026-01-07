/**
 * Validator for Inscribe blocks
 * Validates blocks against indexed roots, ignored paths, file existence rules, and range anchors
 */

import * as fs from 'fs';
import * as path from 'path';
import { ParsedBlock, ValidationError } from '@inscribe/shared';
import { getEffectiveIgnorePrefixes, getOrCreateScope } from '../repository';
import { validateRangeAnchors } from './validateRangeAnchors';

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
