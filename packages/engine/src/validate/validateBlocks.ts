/**
 * Validator for Inscribe blocks
 * Validates blocks against indexed roots, ignored paths, file existence rules, and range anchors
 */

import * as fs from 'fs';
import { ParsedBlock, ValidationError } from '@inscribe/shared';
import { getEffectiveIgnoreMatchers } from '../repository';
import { resolveAndAssertWithinRepo } from '../paths/resolveAndAssertWithin';
import { normalizeRelativePath } from '../util/path';
import { validateRangeAnchors } from './validateRangeAnchors';

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
  const ignoreMatcher = getEffectiveIgnoreMatchers(repoRoot);

  let resolvedPath: string;
  
  try {
    // All modes must remain within the repository root and respect ignore rules
    const resolved = resolveAndAssertWithinRepo(repoRoot, block.file, ignoreMatcher);
    resolvedPath = resolved.resolvedPath;
    normalizeRelativePath(resolved.relativePath);
  } catch (error) {
    errors.push({
      blockIndex: block.blockIndex,
      file: block.file,
      message: error instanceof Error ? error.message : 'Invalid file path',
    });
    return errors;
  }

  const fileExists = fs.existsSync(resolvedPath);

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
        const rangeErrors = validateRangeAnchors(block, resolvedPath);
        errors.push(...rangeErrors);
      }
      break;
  }

  return errors;
}
