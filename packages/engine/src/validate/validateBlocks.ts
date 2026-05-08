/**
 * Validator for Inscribe blocks
 * Validates blocks against indexed roots, ignored paths, file existence rules, and range anchors
 */

import * as fs from 'fs';
import {
  ParsedBlock,
  RESTORE_DIRECTIVE_V2_PAYLOAD,
  RESTORE_DIRECTIVE_V2_SCHEMA,
  RestorePayloadV2,
  ValidationError,
} from '@inscribe/shared';
import { getEffectiveIgnoreMatchers } from '../repository';
import { resolveAndAssertWithinRepo } from '../paths/resolveAndAssertWithin';
import { normalizeRelativePath } from '../util/path';
import { validateRangeAnchors } from './validateRangeAnchors';
import { restoreFromPayload } from '../apply/restoreV2';

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
  const directives = block.directives ?? {};
  const isRestoreV2 = directives[RESTORE_DIRECTIVE_V2_SCHEMA] === '2';

  if (isRestoreV2) {
    return validateRestoreV2Block(block, resolvedPath, fileExists);
  }

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
    case 'append':
    case 'delete':
    case 'range':
    case 'replace_symbol':
      if (!fileExists) {
        errors.push({
          blockIndex: block.blockIndex,
          file: block.file,
          message: `File does not exist (MODE: ${block.mode} requires existing file)`,
        });
      } else if (block.mode === 'range') {
        errors.push(...validateRangeAnchors(block, resolvedPath));
      }
      break;
  }

  return errors;
}

function validateRestoreV2Block(block: ParsedBlock, resolvedPath: string, fileExists: boolean): ValidationError[] {
  const errors: ValidationError[] = [];
  const payloadRaw = block.directives?.[RESTORE_DIRECTIVE_V2_PAYLOAD];

  if (!payloadRaw) {
    return [{
      blockIndex: block.blockIndex,
      file: block.file,
      message: 'Unsafe to restore: missing restore payload.',
    }];
  }

  let payload: RestorePayloadV2;
  try {
    payload = JSON.parse(payloadRaw) as RestorePayloadV2;
  } catch {
    return [{
      blockIndex: block.blockIndex,
      file: block.file,
      message: 'Unsafe to restore: invalid restore payload.',
    }];
  }

  if (payload.schemaVersion !== 2) {
    return [{
      blockIndex: block.blockIndex,
      file: block.file,
      message: 'Unsafe to restore: unsupported restore payload schema.',
    }];
  }

  if (!fileExists) {
    if (payload.mode === 'create' || payload.mode === 'delete') {
      return [];
    }
    return [{
      blockIndex: block.blockIndex,
      file: block.file,
      message: 'Unsafe to restore: file is missing.',
    }];
  }

  const current = fs.readFileSync(resolvedPath, 'utf-8');
  const resolution = restoreFromPayload(current, payload);
  if (!resolution.canResolve) {
    return [{
      blockIndex: block.blockIndex,
      file: block.file,
      message: resolution.error ?? 'Unsafe to restore: unable to resolve restore target.',
    }];
  }

  return errors;
}
