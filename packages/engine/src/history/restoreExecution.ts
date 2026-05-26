import { RestorePayloadV2 } from '@inscribe/shared';
import { PreflightExecution } from '../preflight/preflight';
import { normalizeForMatch, restoreFromPayload, restorePayloadLineEndings, sha256 } from './restoreV2';

export interface RestoreRequest {
  entryId: string;
  payload?: RestorePayloadV2;
}

export interface RestoreFileState {
  exists: boolean;
  content: string;
}

/**
 * Resolves a restore request into a deterministic execution result.
 * This is the internal restore path that avoids public operation semantics.
 */
export function resolveRestoreExecution(
  request: RestoreRequest,
  currentFile: RestoreFileState,
  resolvedPath: string,
  operationIndex: number
): PreflightExecution {
  const { payload } = request;
  if (!payload) {
    throw new Error('Restore execution requires a trusted stored payload');
  }
  const currentContent = currentFile.content;

  // DELIBERATE RESTORE BEHAVIOR PER MODE:

  // 1. create_file restore: delete the file
  if (payload.mode === 'create_file') {
    assertSafeCreateFileRestore(currentFile, payload);
    return {
      kind: 'file_delete',
      mode: 'delete_file',
      operation: { type: payload.mode, file: payload.file, content: '', blockIndex: -1 },
      beforeExists: currentFile.exists,
      afterExists: false,
      beforeContent: currentContent,
      afterContent: '',
      operationIndex,
      resolvedPath,
    };
  }

  // 2. delete_file restore: recreate the file with oldContent
  if (payload.mode === 'delete_file') {
    assertSafeDeleteFileRestore(currentFile, payload.oldContent);
    const restoredContent = restorePayloadLineEndings(payload.oldContent, payload);

    return {
      kind: 'file_content',
      mode: 'create_file',
      operation: { type: payload.mode, file: payload.file, content: restoredContent, blockIndex: -1 },
      beforeExists: currentFile.exists,
      afterExists: true,
      beforeContent: currentContent,
      afterContent: restoredContent,
      operationIndex,
      resolvedPath,
    };
  }

  // 3. replace_file / append_file / partial replacements:
  // These all use the context-aware restoreFromPayload logic.
  const resolution = restoreFromPayload(currentContent, payload);

  if (!resolution.canResolve || resolution.resolvedContent === undefined) {
    throw new Error(resolution.error ?? 'Unsafe to restore: unable to resolve restore target.');
  }

  const afterContent = resolution.resolvedContent;

  return {
    kind: 'file_content',
    mode: 'replace_file', // internal mapped mode for any non-delete content restoration
    operation: {
      type: payload.mode,
      file: payload.file,
      content: afterContent,
      blockIndex: -1,
    },
    beforeExists: currentFile.exists,
    afterExists: true,
    beforeContent: currentContent,
    afterContent,
    operationIndex,
    resolvedPath,
  };
}

function assertSafeCreateFileRestore(currentFile: RestoreFileState, payload: RestorePayloadV2): void {
  if (!currentFile.exists) {
    return;
  }

  const normalizedCurrent = normalizeForMatch(currentFile.content);
  if (
    sha256(normalizedCurrent) === payload.appliedFileHash &&
    normalizedCurrent === payload.newContent
  ) {
    return;
  }

  throw new Error('Unsafe to restore create_file: target file was modified after apply.');
}

function assertSafeDeleteFileRestore(currentFile: RestoreFileState, oldContent: string): void {
  if (!currentFile.exists) {
    return;
  }

  if (currentFile.content === oldContent || currentFile.content.length === 0) {
    return;
  }

  throw new Error('Unsafe to restore delete_file: target file was recreated with unrelated content.');
}
