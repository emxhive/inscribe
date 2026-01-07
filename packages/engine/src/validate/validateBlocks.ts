/**
 * Validator for Inscribe blocks
 * Validates blocks against indexed roots, ignored paths, file existence rules, and range anchors
 */

import * as fs from 'fs';
import { ParsedBlock, ValidationError } from '@inscribe/shared';
import { getEffectiveIgnorePrefixes, getOrCreateScope } from '../repository';
import { resolveAndAssertWithin } from '../paths/resolveAndAssertWithin';
import { ensureTrailingSlash, normalizeRelativePath } from '../util/path';
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
  const scopeState = getOrCreateScope(repoRoot);
  const scopeRoots = scopeState.scope;

  let resolvedPath: string;
  let normalizedFile: string;
  try {
    const resolved = resolveAndAssertWithin(repoRoot, block.file, scopeRoots);
    resolvedPath = resolved.resolvedPath;
    normalizedFile = normalizeRelativePath(resolved.relativePath);
  } catch (error) {
    errors.push({
      blockIndex: block.blockIndex,
      file: block.file,
      message: error instanceof Error ? error.message : 'Invalid file path',
    });
    return errors;
  }

  // Check if file path is in an ignored path
  const ignores = getEffectiveIgnorePrefixes(repoRoot);
  const filePrefix = ensureTrailingSlash(normalizedFile);
  const ignoreMatch = ignores.find(ignored => filePrefix.startsWith(ignored));

  if (ignoreMatch) {
    errors.push({
      blockIndex: block.blockIndex,
      file: normalizedFile,
      message: `File is ignored by rules: ${ignores.join(', ')}`,
    });
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
