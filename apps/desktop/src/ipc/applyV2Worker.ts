import { applyPreparedFileMutations } from '@inscribe/engine';
import { ApplyV2SessionStore, defaultApplyV2SessionStore } from './applyV2SessionStore';
import type {
  ApplyV2WorkerPayload,
  ApplyV2WorkerResponse,
  ApplyV2ErrorDTO,
  ApplyV2ErrorType,
} from './applyV2Types';

export async function runApplyV2Worker(
  payload: ApplyV2WorkerPayload,
  sessionStore: ApplyV2SessionStore = defaultApplyV2SessionStore,
): Promise<ApplyV2WorkerResponse> {
  try {
    // Runtime payload validation
    if (
      !payload ||
      typeof payload !== 'object' ||
      typeof payload.trustedRepoRoot !== 'string' ||
      payload.trustedRepoRoot.trim().length === 0 ||
      typeof payload.previewToken !== 'string' ||
      payload.previewToken.trim().length === 0
    ) {
      return {
        ok: false,
        errors: [{
          type: 'system',
          code: 'INVALID_WORKER_PAYLOAD',
          message: 'Invalid V2 apply worker payload.',
        }],
      };
    }

    const { trustedRepoRoot, previewToken } = payload;

    // Consume token first
    let session;
    try {
      session = sessionStore.consumeSession(previewToken, trustedRepoRoot);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg === 'PREVIEW_SESSION_NOT_FOUND') {
        return {
          ok: false,
          errors: [{
            type: 'session',
            code: 'PREVIEW_SESSION_NOT_FOUND',
            message: 'Preview session was not found or has expired.',
          }],
        };
      }
      if (errMsg === 'PREVIEW_SESSION_ROOT_MISMATCH') {
        return {
          ok: false,
          errors: [{
            type: 'session',
            code: 'PREVIEW_SESSION_ROOT_MISMATCH',
            message: 'Preview session does not belong to this repository.',
          }],
        };
      }
      if (errMsg === 'INVALID_REPO_ROOT') {
        return {
          ok: false,
          errors: [{
            type: 'workspace',
            code: 'INVALID_REPO_ROOT',
            message: 'Invalid repository root.',
          }],
        };
      }
      // Any other session consumption errors mapped to system error
      return {
        ok: false,
        errors: [{
          type: 'system',
          code: 'UNEXPECTED_SYSTEM_ERROR',
          message: 'V2 apply worker failed.',
        }],
      };
    }

    // Apply frozen final mutations only
    const result = applyPreparedFileMutations(trustedRepoRoot, session.finalMutations);
    if (!result.ok) {
      const errors: ApplyV2ErrorDTO[] = result.errors.map((err) => {
        let type: ApplyV2ErrorType = 'system';
        if (
          err.code === 'WORKSPACE_DRIFT' ||
          err.code === 'FILE_READ_FAILED' ||
          err.code === 'BINARY_FILE_NOT_SUPPORTED' ||
          err.code === 'INVALID_UTF8_FILE' ||
          err.code === 'CANONICAL_PATH_COLLISION' ||
          err.code === 'INVALID_WORKSPACE_PATH'
        ) {
          type = 'workspace';
        } else if (err.code === 'HISTORY_PERSISTENCE_FAILED') {
          type = 'history';
        } else if (
          err.code === 'INVALID_PREPARED_MUTATION' ||
          err.code === 'APPLY_WRITE_FAILED' ||
          err.code === 'ROLLBACK_FAILED'
        ) {
          type = 'apply';
        }

        let publicMessage = 'An unexpected error occurred during V2 apply.';
        switch (err.code) {
          case 'INVALID_PREPARED_MUTATION':
            publicMessage = 'Invalid prepared mutation plan.';
            break;
          case 'INVALID_WORKSPACE_PATH':
            publicMessage = 'Workspace path is invalid.';
            break;
          case 'CANONICAL_PATH_COLLISION':
            publicMessage = 'Multiple mutations target the same workspace path.';
            break;
          case 'WORKSPACE_DRIFT':
            publicMessage = 'Workspace changed after preview. Preview the changes again.';
            break;
          case 'FILE_READ_FAILED':
            publicMessage = 'Workspace file could not be read.';
            break;
          case 'BINARY_FILE_NOT_SUPPORTED':
            publicMessage = 'Binary files are not supported.';
            break;
          case 'INVALID_UTF8_FILE':
            publicMessage = 'Workspace file is not valid UTF-8 text.';
            break;
          case 'APPLY_WRITE_FAILED':
            publicMessage = 'V2 apply failed while writing files.';
            break;
          case 'HISTORY_PERSISTENCE_FAILED':
            publicMessage = 'V2 apply failed while recording history.';
            break;
          case 'ROLLBACK_FAILED':
            publicMessage = 'V2 apply rollback did not complete.';
            break;
        }

        return {
          type,
          code: err.code,
          message: publicMessage,
          filePath: err.filePath,
        };
      });
      return {
        ok: false,
        errors,
      };
    }

    return {
      ok: true,
      appliedFileCount: result.appliedFileCount,
      historyEntries: result.historyEntries,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      errors: [{
        type: 'system',
        code: 'UNEXPECTED_SYSTEM_ERROR',
        message: 'V2 apply worker failed.',
      }],
    };
  }
}
