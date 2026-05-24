import { HistoryEntry, RestorePayloadV2 } from '@inscribe/shared';
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
  const resolution = restoreFromPayload(currentContent, request.payload);

  if (!resolution.canResolve || resolution.resolvedContent === undefined) {
    throw new Error(resolution.error ?? 'Unsafe to restore: unable to resolve restore target.');
  }

  // Restore always results in a state where the file exists (unless we add delete_file restore support)
  // For now, based on RestorePayloadV2, it's about reverting content.

  // Note: if payload.mode was 'create_file', restoring it means deleting it.
  const afterExists = request.payload.mode !== 'create_file';
  const afterContent = afterExists ? resolution.resolvedContent : '';

  return {
    kind: afterExists ? 'file_content' : 'file_delete',
    mode: (afterExists ? 'replace_file' : 'delete_file') as any, // internal mapped mode
    operation: {
      type: (afterExists ? 'replace_file' : 'delete_file') as any,
      file: request.payload.file,
      content: afterContent,
      blockIndex: -1, // Internal operation
    },
    beforeExists: true, // we are restoring from an existing (applied) state
    afterExists,
    beforeContent: currentContent,
    afterContent,
    operationIndex,
    resolvedPath,
  };
}
