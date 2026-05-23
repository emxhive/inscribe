import * as fs from 'fs';
import {
  DIAGNOSTIC_CODES, Operation, ParsedBlock, RESTORE_DIRECTIVE_V2_PAYLOAD, RESTORE_DIRECTIVE_V2_SCHEMA, RestorePayloadV2, ValidationError,
  getOperationModeMetadata, getAllowedDirectives, getRequiredDirectives, modeAllowsDirective, modeAllowsEmptyContent, modeRequiresContent,
} from '@inscribe/shared';
import { getEffectiveIgnoreMatchers } from '../repository';
import { resolveAndAssertWithinRepo } from '../paths/resolveAndAssertWithin';
import { normalizeRelativePath } from '../util/path';
import { validateRangeAnchors } from './validateRangeAnchors';
import { restoreFromPayload } from '../apply/restoreV2';
import { PreflightError, preflightOperations } from '../apply/preflight';

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
    return [{ blockIndex: block.blockIndex, file: block.file, message: error instanceof Error ? error.message : 'Invalid file path' }];
  }
  const fileExists = fs.existsSync(resolvedPath);
  const directives = block.directives ?? {};
  if (directives[RESTORE_DIRECTIVE_V2_SCHEMA] === '2') return validateRestoreV2Block(block, resolvedPath, fileExists);

  const metadata = getOperationModeMetadata(block.mode);
  if (metadata.fileExistence === 'must_exist' && !fileExists) errors.push({ blockIndex: block.blockIndex, file: block.file, code: DIAGNOSTIC_CODES.FILE_MUST_EXIST, message: `File does not exist (MODE: ${block.mode} requires existing file)` });
  if (metadata.fileExistence === 'must_not_exist' && fileExists) errors.push({ blockIndex: block.blockIndex, file: block.file, code: DIAGNOSTIC_CODES.FILE_MUST_NOT_EXIST, message: `File already exists (MODE: ${block.mode} requires non-existing file)` });

  if (modeRequiresContent(block.mode) && !modeAllowsEmptyContent(block.mode) && block.content.length === 0) errors.push({ blockIndex: block.blockIndex, file: block.file, code: DIAGNOSTIC_CODES.EMPTY_CONTENT_NOT_ALLOWED, message: `${block.mode} does not allow empty content` });

  const allowed = new Set(getAllowedDirectives(block.mode));
  const required = getRequiredDirectives(block.mode);
  for (const key of Object.keys(directives)) if (!modeAllowsDirective(block.mode, key) && !key.startsWith('RESTORE_')) errors.push({ blockIndex: block.blockIndex, file: block.file, code: DIAGNOSTIC_CODES.INVALID_DIRECTIVE, message: `Invalid directive ${key} for mode ${block.mode}` });
  for (const key of required) if (!directives[key]) errors.push({ blockIndex: block.blockIndex, file: block.file, code: DIAGNOSTIC_CODES.MISSING_DIRECTIVE, message: `Missing required directive ${key} for mode ${block.mode}` });

  if ((block.mode === 'replace_range' || block.mode === 'replace_between' || block.mode === 'replace_line') && fileExists) {
    errors.push(...validateRangeAnchors(block, resolvedPath));
  }

  return errors;
}

function validatePlanPreflight(blocks: ParsedBlock[], repoRoot: string): ValidationError[] { const operations: Operation[] = blocks.map((block) => ({ type: block.mode, file: block.file, content: block.content, directives: block.directives, blockIndex: block.blockIndex })); try { preflightOperations(operations, repoRoot); return []; } catch (error) { if (error instanceof PreflightError) return [{ blockIndex: error.operation.blockIndex ?? error.operationIndex, file: error.operation.file, message: error.message }]; return [{ blockIndex: -1, file: '', message: error instanceof Error ? error.message : 'Unknown validation error' }]; } }

function validateRestoreV2Block(block: ParsedBlock, resolvedPath: string, fileExists: boolean): ValidationError[] { const payloadRaw = block.directives?.[RESTORE_DIRECTIVE_V2_PAYLOAD]; if (!payloadRaw) return [{ blockIndex: block.blockIndex, file: block.file, message: 'Unsafe to restore: missing restore payload.' }]; let payload: RestorePayloadV2; try { payload = JSON.parse(payloadRaw) as RestorePayloadV2; } catch { return [{ blockIndex: block.blockIndex, file: block.file, message: 'Unsafe to restore: invalid restore payload.' }]; } if (payload.schemaVersion !== 2) return [{ blockIndex: block.blockIndex, file: block.file, message: 'Unsafe to restore: unsupported restore payload schema.' }]; if (!fileExists) { if (payload.mode === 'create_file' || payload.mode === 'delete_file') return []; return [{ blockIndex: block.blockIndex, file: block.file, message: 'Unsafe to restore: file is missing.' }]; }
  const current = fs.readFileSync(resolvedPath, 'utf-8'); const resolution = restoreFromPayload(current, payload); if (!resolution.canResolve) return [{ blockIndex: block.blockIndex, file: block.file, message: resolution.error ?? 'Unsafe to restore: unable to resolve restore target.' }]; return []; }
