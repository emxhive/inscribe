/**
 * Validator for Inscribe blocks
 * Validates blocks against indexed roots, ignored paths, file existence rules, and range anchors
 */

import * as fs from 'fs';
import {
  Operation,
  ParsedBlock,
  RESTORE_DIRECTIVE_EXPECT_APPEND_AT_END,
  RESTORE_DIRECTIVE_EXPECT_CONTENT,
  RESTORE_DIRECTIVE_REMOVE_APPEND,
  ValidationError,
} from '@inscribe/shared';
import { getEffectiveIgnoreMatchers } from '../repository';
import { resolveAndAssertWithinRepo } from '../paths/resolveAndAssertWithin';
import { normalizeRelativePath } from '../util/path';
import { validateRangeAnchors } from './validateRangeAnchors';
import { resolveRangeReplacement } from '../apply/resolveRangeReplacement';

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
      if (fileExists) {
        errors.push(...validateExpectedContent(block, resolvedPath));
      }
      break;

    case 'append':
      if (!fileExists) {
        errors.push({
          blockIndex: block.blockIndex,
          file: block.file,
          message: 'File does not exist (MODE: append requires existing file)',
        });
      } else if (block.directives?.[RESTORE_DIRECTIVE_REMOVE_APPEND] === 'true') {
        errors.push(...validateExpectedAppend(block, resolvedPath));
      }
      break;

    case 'delete':
      if (!fileExists) {
        errors.push({
          blockIndex: block.blockIndex,
          file: block.file,
          message: 'File does not exist (MODE: delete requires existing file)',
        });
      } else {
        errors.push(...validateExpectedContent(block, resolvedPath));
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
        if (rangeErrors.length === 0) {
          errors.push(...validateExpectedRangeContent(block, resolvedPath));
        }
      }
      break;
  }

  return errors;
}

function validateExpectedContent(block: ParsedBlock, resolvedPath: string): ValidationError[] {
  const expected = block.directives?.[RESTORE_DIRECTIVE_EXPECT_CONTENT];
  if (expected === undefined) {
    return [];
  }
  const actual = fs.readFileSync(resolvedPath, 'utf-8');
  if (actual !== expected) {
    return [
      {
        blockIndex: block.blockIndex,
        file: block.file,
        message: 'Unsafe to restore: file content has changed since apply.',
      },
    ];
  }
  return [];
}

function validateExpectedAppend(block: ParsedBlock, resolvedPath: string): ValidationError[] {
  const expected =
    block.directives?.[RESTORE_DIRECTIVE_EXPECT_APPEND_AT_END] ?? block.content;
  const actual = fs.readFileSync(resolvedPath, 'utf-8');
  if (!actual.endsWith(expected)) {
    return [
      {
        blockIndex: block.blockIndex,
        file: block.file,
        message: 'Unsafe to restore: appended content not found at file end.',
      },
    ];
  }
  return [];
}

function validateExpectedRangeContent(block: ParsedBlock, resolvedPath: string): ValidationError[] {
  const expected = block.directives?.[RESTORE_DIRECTIVE_EXPECT_CONTENT];
  if (expected === undefined) {
    return [];
  }
  try {
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const operation: Operation = {
      type: 'range',
      file: block.file,
      content: block.content,
      directives: block.directives,
    };
    const resolved = resolveRangeReplacement(content, operation);
    if (resolved.removed !== expected) {
      return [
        {
          blockIndex: block.blockIndex,
          file: block.file,
          message: 'Unsafe to restore: range content has changed since apply.',
        },
      ];
    }
  } catch (error) {
    return [
      {
        blockIndex: block.blockIndex,
        file: block.file,
        message: error instanceof Error ? error.message : 'Unsafe to restore: range anchors invalid.',
      },
    ];
  }
  return [];
}
