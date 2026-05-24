import { getOperationModeMetadata, Operation, OperationMode } from '@inscribe/shared';
import { resolveStructuralAdapter } from '../language/registry';
import { resolveBetweenTarget, resolveLineTarget, resolveRangeTarget } from '../target/textTargets';
import { resolveBlockTarget } from '../target/blockTarget';
import { resolveSymbolTarget } from '../target/symbolTarget';

export type OperationFileState = { exists: boolean; content: string };
export type Replacement = { oldStart:number; oldEnd:number; newStart:number; newEnd:number; oldText:string; newText:string };

type Base = { operation: Operation; beforeExists:boolean; afterExists:boolean; beforeContent:string; afterContent:string };
export type FileContentExecutionResult = Base & { kind:'file_content'; mode:'create_file'|'replace_file'|'append_file' };
export type FileDeleteExecutionResult = Base & { kind:'file_delete'; mode:'delete_file' };
export type PartialReplacementExecutionResult = Base & { kind:'partial_replacement'; mode:'replace_line'|'replace_range'|'replace_between'|'replace_block'|'replace_symbol'; replacement: Replacement };
export type OperationExecutionResult = FileContentExecutionResult | FileDeleteExecutionResult | PartialReplacementExecutionResult;

/**
 * Resolve operation semantics into deterministic before/after state and optional replacement spans.
 * Offsets are JavaScript string UTF-16 code unit indices.
 */
export function resolveOperationExecution(operation: Operation, fileState: OperationFileState): OperationExecutionResult {
  const metadata = getOperationModeMetadata(operation.type as OperationMode);
  if (metadata.fileExistence === 'must_exist' && !fileState.exists) throw new Error(`File does not exist (MODE: ${operation.type} requires existing file)`);
  if (metadata.fileExistence === 'must_not_exist' && fileState.exists) throw new Error(`File already exists (MODE: ${operation.type} requires non-existing file)`);

  const beforeContent = fileState.content;
  switch (operation.type) {
    case 'create_file':
    case 'replace_file':
      return { kind:'file_content', mode:operation.type, operation, beforeExists:fileState.exists, afterExists:true, beforeContent, afterContent:operation.content };
    case 'append_file':
      return { kind:'file_content', mode:'append_file', operation, beforeExists:fileState.exists, afterExists:true, beforeContent, afterContent: `${beforeContent}${operation.content}` };
    case 'delete_file':
      return { kind:'file_delete', mode:'delete_file', operation, beforeExists:fileState.exists, afterExists:false, beforeContent, afterContent:'' };
    case 'replace_line':
      return partial(operation, fileState, resolveLineTarget(beforeContent, operation.directives ?? {}));
    case 'replace_range':
      return partial(operation, fileState, resolveRangeTarget(beforeContent, operation.directives ?? {}));
    case 'replace_between':
      return partial(operation, fileState, resolveBetweenTarget(beforeContent, operation.directives ?? {}));
    case 'replace_block':
      return partial(operation, fileState, resolveBlockTarget(beforeContent, operation.directives ?? {}));
    case 'replace_symbol': {
      const range = resolveSymbolTarget(beforeContent, operation.directives ?? {}, resolveStructuralAdapter(operation.file));
      return partial(operation, fileState, range);
    }
    default:
      throw new Error(`Unknown operation type: ${operation.type}`);
  }
}

function partial(operation: Operation, fileState: OperationFileState, range: { replaceStart:number; replaceEnd:number }): PartialReplacementExecutionResult {
  const beforeContent = fileState.content;
  const prefix = beforeContent.slice(0, range.replaceStart);
  const suffix = beforeContent.slice(range.replaceEnd);
  const insert = normalizeInsert(operation.content, suffix, beforeContent, range, operation.type as OperationMode);
  const afterContent = `${prefix}${insert}${suffix}`;
  return {
    kind:'partial_replacement',
    mode: operation.type as PartialReplacementExecutionResult['mode'],
    operation,
    beforeExists: fileState.exists,
    afterExists: true,
    beforeContent,
    afterContent,
    replacement: {
      oldStart: range.replaceStart,
      oldEnd: range.replaceEnd,
      newStart: prefix.length,
      newEnd: prefix.length + insert.length,
      oldText: beforeContent.slice(range.replaceStart, range.replaceEnd),
      newText: insert,
    },
  };
}

function normalizeInsert(insert: string, suffix: string, beforeContent: string, range: { replaceStart:number; replaceEnd:number }, mode: OperationMode): string {
  if (!suffix || !insert) return insert;
  // Same-line replace_between should replace exact interior text without line normalization.
  if (mode === 'replace_between') {
    const replaced = beforeContent.slice(range.replaceStart, range.replaceEnd);
    if (!replaced.includes('\n')) return insert;
  }
  return insert.endsWith('\n') ? insert : `${insert}\n`;
}
