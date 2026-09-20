import { RestorePayloadV2 } from '@inscribe/shared';
import { PreflightExecution } from '../apply/executionTypes';
import { normalizeForMatch, restorePayloadLineEndings, sha256 } from './restoreV2';

export interface RestoreRequest {
  entryId: string;
  payload?: RestorePayloadV2;
}

export interface RestoreFileState {
  exists: boolean;
  content: string;
}

/** restore is only eligible when the recorded post-action state is exact. */
export function resolveExactRestoreExecution(
  request: RestoreRequest,
  currentFile: RestoreFileState,
  resolvedPath: string,
  operationIndex: number,
): PreflightExecution {
  const { payload } = request;
  if (!payload) {
    throw new Error('restore execution requires a trusted stored payload');
  }

  const currentContent = currentFile.content;
  if (payload.mode === 'create_file') {
    assertExactCreatedFile(currentFile, payload);
    return {
      kind: 'file_delete',
      mode: 'delete_file',
      operation: { type: payload.mode, file: payload.file, content: '', blockIndex: -1 },
      beforeExists: true,
      afterExists: false,
      beforeContent: currentContent,
      afterContent: '',
      operationIndex,
      resolvedPath,
    };
  }

  if (payload.mode === 'delete_file') {
    if (currentFile.exists) {
      throw new Error('Unsafe to restore delete_file: target file was recreated or modified after apply.');
    }
    const restoredContent = restorePayloadLineEndings(payload.oldContent, payload);
    return {
      kind: 'file_content',
      mode: 'create_file',
      operation: { type: payload.mode, file: payload.file, content: restoredContent, blockIndex: -1 },
      beforeExists: false,
      afterExists: true,
      beforeContent: '',
      afterContent: restoredContent,
      operationIndex,
      resolvedPath,
    };
  }

  if (!currentFile.exists || sha256(normalizeForMatch(currentContent)) !== payload.appliedFileHash) {
    throw new Error('Unsafe to restore action: target file no longer matches its exact post-action state.');
  }

  const normalizedCurrent = normalizeForMatch(currentContent);
  if (normalizedCurrent.slice(payload.newSpanStart, payload.newSpanEnd) !== payload.newContent) {
    throw new Error('Unsafe to restore action: recorded post-action span does not match.');
  }

  const afterContent = restorePayloadLineEndings(
    normalizedCurrent.slice(0, payload.newSpanStart)
      + payload.oldContent
      + normalizedCurrent.slice(payload.newSpanEnd),
    payload,
  );
  return {
    kind: 'file_content',
    mode: 'replace_file',
    operation: { type: payload.mode, file: payload.file, content: afterContent, blockIndex: -1 },
    beforeExists: true,
    afterExists: true,
    beforeContent: currentContent,
    afterContent,
    operationIndex,
    resolvedPath,
  };
}

function assertExactCreatedFile(currentFile: RestoreFileState, payload: RestorePayloadV2): void {
  if (!currentFile.exists
    || sha256(normalizeForMatch(currentFile.content)) !== payload.appliedFileHash
    || normalizeForMatch(currentFile.content) !== payload.newContent) {
    throw new Error('Unsafe to restore create_file: target file no longer matches its exact post-action state.');
  }
}
