import { RestorePayloadV2 } from '@inscribe/shared';
import { PreflightExecution } from '../preflight/preflight';
import { restoreFromPayload } from './restoreV2';

export interface RestoreRequest {
  entryId: string;
  payload: RestorePayloadV2;
}

/**
 * Resolves a restore request into a deterministic execution result.
 * This is the internal restore path that avoids public operation semantics.
 */
export function resolveRestoreExecution(
  request: RestoreRequest,
  currentContent: string,
  resolvedPath: string,
  operationIndex: number
): PreflightExecution {
  const { payload } = request;

  // DELIBERATE RESTORE BEHAVIOR PER MODE:

  // 1. create_file restore: delete the file
  if (payload.mode === 'create_file') {
     return {
      kind: 'file_delete',
      mode: 'delete_file',
      operation: { type: 'delete_file', file: payload.file, content: '', blockIndex: -1 },
      beforeExists: true,
      afterExists: false,
      beforeContent: currentContent,
      afterContent: '',
      operationIndex,
      resolvedPath,
    };
  }

  // 2. delete_file restore: recreate the file with oldContent
  if (payload.mode === 'delete_file') {
    return {
      kind: 'file_content',
      mode: 'create_file',
      operation: { type: 'create_file', file: payload.file, content: payload.oldContent, blockIndex: -1 },
      beforeExists: false,
      afterExists: true,
      beforeContent: '',
      afterContent: payload.oldContent,
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
      type: 'replace_file',
      file: payload.file,
      content: afterContent,
      blockIndex: -1,
    },
    beforeExists: true,
    afterExists: true,
    beforeContent: currentContent,
    afterContent,
    operationIndex,
    resolvedPath,
  };
}
