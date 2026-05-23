import * as fs from 'fs';
import {
  DIAGNOSTIC_CODES,
  type DiagnosticCode,
  Operation,
  ParsedBlock,
  RESTORE_DIRECTIVE_V2_PAYLOAD,
  RESTORE_DIRECTIVE_V2_SCHEMA,
  RestorePayloadV2,
  ValidationError,
  getOperationModeMetadata,
  getRequiredDirectives,
  modeAllowsDirective,
  modeAllowsEmptyContent,
  modeRequiresContent,
} from '@inscribe/shared';
import { PreflightError, preflightOperations } from '../apply/preflight';
import { restoreFromPayload } from '../apply/restoreV2';
import { resolveAndAssertWithinRepo } from '../paths/resolveAndAssertWithin';
import { getEffectiveIgnoreMatchers } from '../repository';
import { normalizeRelativePath } from '../util/path';
import { validateRangeAnchors } from './validateRangeAnchors';

function buildError(
  block: Pick<ParsedBlock, 'blockIndex' | 'file'>,
  message: string,
  code?: DiagnosticCode,
): ValidationError {
  return { blockIndex: block.blockIndex, file: block.file, message, code };
}

export function validateBlocks(blocks: ParsedBlock[], repoRoot: string): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const block of blocks) errors.push(...validateBlock(block, repoRoot));
  if (errors.length === 0) errors.push(...validatePlanPreflight(blocks, repoRoot));
  return errors;
}

function validateBlock(block: ParsedBlock, repoRoot: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const ignoreMatcher = getEffectiveIgnoreMatchers(repoRoot);

  let resolvedPath: string;
  try {
    const resolved = resolveAndAssertWithinRepo(repoRoot, block.file, ignoreMatcher);
    resolvedPath = resolved.resolvedPath;
    normalizeRelativePath(resolved.relativePath);
  } catch (error) {
    return [buildError(block, error instanceof Error ? error.message : 'Invalid file path')];
  }

  const fileExists = fs.existsSync(resolvedPath);
  const directives = block.directives ?? {};

  if (directives[RESTORE_DIRECTIVE_V2_SCHEMA] === '2') {
    return validateRestoreV2Block(block, resolvedPath, fileExists);
  }

  const metadata = getOperationModeMetadata(block.mode);
  if (metadata.fileExistence === 'must_exist' && !fileExists) {
    errors.push(buildError(block, `File does not exist (MODE: ${block.mode} requires existing file)`, DIAGNOSTIC_CODES.FILE_MUST_EXIST));
  }
  if (metadata.fileExistence === 'must_not_exist' && fileExists) {
    errors.push(buildError(block, `File already exists (MODE: ${block.mode} requires non-existing file)`, DIAGNOSTIC_CODES.FILE_MUST_NOT_EXIST));
  }

  if (modeRequiresContent(block.mode) && !modeAllowsEmptyContent(block.mode) && block.content.length === 0) {
    errors.push(buildError(block, `${block.mode} does not allow empty content`, DIAGNOSTIC_CODES.EMPTY_CONTENT_NOT_ALLOWED));
  }

  const required = getRequiredDirectives(block.mode);
  for (const key of Object.keys(directives)) {
    if (!modeAllowsDirective(block.mode, key) && !key.startsWith('RESTORE_')) {
      errors.push(buildError(block, `Invalid directive ${key} for mode ${block.mode}`, DIAGNOSTIC_CODES.INVALID_DIRECTIVE));
    }
  }
  for (const key of required) {
    if (!directives[key]) {
      errors.push(buildError(block, `Missing required directive ${key} for mode ${block.mode}`, DIAGNOSTIC_CODES.MISSING_DIRECTIVE));
    }
  }

  if ((block.mode === 'replace_range' || block.mode === 'replace_between' || block.mode === 'replace_line') && fileExists) {
    errors.push(...validateRangeAnchors(block, resolvedPath));
  }

  return errors;
}

function validatePlanPreflight(blocks: ParsedBlock[], repoRoot: string): ValidationError[] {
  const operations: Operation[] = blocks.map((block) => ({
    type: block.mode,
    file: block.file,
    content: block.content,
    directives: block.directives,
    blockIndex: block.blockIndex,
  }));

  try {
    preflightOperations(operations, repoRoot);
    return [];
  } catch (error) {
    if (error instanceof PreflightError) {
      return [{
        blockIndex: error.operation.blockIndex ?? error.operationIndex,
        file: error.operation.file,
        message: error.message,
      }];
    }
    return [{ blockIndex: -1, file: '', message: error instanceof Error ? error.message : 'Unknown validation error' }];
  }
}

function validateRestoreV2Block(block: ParsedBlock, resolvedPath: string, fileExists: boolean): ValidationError[] {
  const payloadRaw = block.directives?.[RESTORE_DIRECTIVE_V2_PAYLOAD];
  if (!payloadRaw) return [buildError(block, 'Unsafe to restore: missing restore payload.')];

  let payload: RestorePayloadV2;
  try {
    payload = JSON.parse(payloadRaw) as RestorePayloadV2;
  } catch {
    return [buildError(block, 'Unsafe to restore: invalid restore payload.')];
  }

  if (payload.schemaVersion !== 2) {
    return [buildError(block, 'Unsafe to restore: unsupported restore payload schema.')];
  }

  if (!fileExists) {
    if (payload.mode === 'create_file' || payload.mode === 'delete_file') return [];
    return [buildError(block, 'Unsafe to restore: file is missing.')];
  }

  const current = fs.readFileSync(resolvedPath, 'utf-8');
  const resolution = restoreFromPayload(current, payload);
  if (!resolution.canResolve) {
    return [buildError(block, resolution.error ?? 'Unsafe to restore: unable to resolve restore target.')];
  }

  return [];
}
