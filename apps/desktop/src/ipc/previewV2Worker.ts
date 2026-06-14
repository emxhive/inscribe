import { v2 } from '@inscribe/engine';
import { loadInitialFiles, WorkspacePreviewError } from './previewV2Workspace';
import type { V2Operation } from '@inscribe/shared';
import type {
  PreviewV2WorkerPayload,
  PreviewV2WorkerResponse,
  PreviewV2ExecutionDTO,
  PreviewV2ErrorDTO,
} from './previewV2Types';
import { ApplyV2SessionStore, PreviewV2InitialFileSnapshot, defaultApplyV2SessionStore } from './applyV2SessionStore';
import { createHash } from 'crypto';

function mapResolutionError(msg: string): string {
  const exactCodes = [
    'STRUCTURAL_RESOLVER_REQUIRED',
    'TARGET_NOT_FOUND',
    'TARGET_AMBIGUOUS',
    'TARGET_QUALIFIER_NOT_MATCHED',
    'UNSUPPORTED_EXTENSION',
    'RUNTIME_INITIALIZATION_FAILED',
    'MISSING_WASM_ASSET',
    'PARSER_DIAGNOSTICS_PRESENT',
    'INVALID_SELECTOR',
    'UNSUPPORTED_NODE_SHAPE',
    'MUTABLE_TARGET_AMBIGUOUS',
    'FALLBACK_TARGET_AMBIGUOUS',
  ];
  if (exactCodes.includes(msg)) {
    return msg;
  }
  if (msg.startsWith('TARGET_NOT_FOUND')) {
    return 'TARGET_NOT_FOUND';
  }
  if (msg.startsWith('MUTABLE_TARGET_AMBIGUOUS')) {
    return 'MUTABLE_TARGET_AMBIGUOUS';
  }
  if (msg.startsWith('FALLBACK_TARGET_AMBIGUOUS')) {
    return 'FALLBACK_TARGET_AMBIGUOUS';
  }
  if (msg.startsWith('File already exists')) {
    return 'FILE_ALREADY_EXISTS';
  }
  if (msg.startsWith('File does not exist')) {
    return 'FILE_NOT_FOUND';
  }
  return 'RESOLUTION_FAILED';
}

/**
 * Orchestrates rawInscribeBlocks parsing, safe file loading, structural resolver binding,
 * and sequential plan resolution on the worker.
 *
 * NOTE: resolvePlan() is currently fail-fast. Thus, the returned resolution
 * responses will contain at most one resolution error.
 */
export async function runPreviewV2Worker(
  payload: PreviewV2WorkerPayload,
  sessionStore: ApplyV2SessionStore = defaultApplyV2SessionStore
): Promise<PreviewV2WorkerResponse> {
  // Narrow runtime validation of the internal worker payload before destructuring
  if (
    !payload ||
    typeof payload !== 'object' ||
    typeof payload.rawInput !== 'string' ||
    typeof payload.trustedRepoRoot !== 'string' ||
    !payload.assetPaths ||
    typeof payload.assetPaths !== 'object' ||
    typeof payload.assetPaths.coreWasmPath !== 'string' ||
    typeof payload.assetPaths.typescriptWasmPath !== 'string' ||
    typeof payload.assetPaths.tsxWasmPath !== 'string'
  ) {
    return {
      ok: false,
      errors: [
        {
          type: 'system',
          code: 'INVALID_WORKER_PAYLOAD',
          message: 'Invalid V2 preview worker payload.',
        },
      ],
    };
  }

  const { rawInput, trustedRepoRoot, assetPaths } = payload;
  try {
    let operations: V2Operation[];
    try {
      operations = v2.parseInscribeBlocks(rawInput);
    } catch (err: unknown) {
      if (err instanceof v2.V2ProtocolError) {
        return {
          ok: false,
          errors: [
            {
              type: 'protocol',
              code: err.code,
              message: err.message,
              blockIndex: err.blockIndex,
              line: err.line,
              context: err.context,
            },
          ],
        };
      }
      throw err;
    }

    const filePaths = Array.from(new Set(operations.map((op) => op.filePath)));

    let initialFiles: Map<string, { content: string; exists: boolean }>;
    try {
      initialFiles = loadInitialFiles(trustedRepoRoot, filePaths);
    } catch (err: unknown) {
      if (err instanceof WorkspacePreviewError) {
        return {
          ok: false,
          errors: [
            {
              type: 'workspace',
              code: err.code,
              message: err.message,
              filePath: err.filePath,
            },
          ],
        };
      }
      return {
        ok: false,
        errors: [
          {
            type: 'workspace',
            code: 'FILE_READ_FAILED',
            message: 'Workspace file loading failed.',
          },
        ],
      };
    }

    const structuralResolver = v2.createStructuralResolver(assetPaths);
    const resolvedPlan = await v2.resolvePlan(operations, initialFiles, {
      structuralResolver,
    });

    if (resolvedPlan.errors && resolvedPlan.errors.length > 0) {
      const errors: PreviewV2ErrorDTO[] = resolvedPlan.errors.map((err) => {
        const op = operations[err.stepIndex];
        return {
          type: 'resolution',
          code: mapResolutionError(err.message),
          message: err.message,
          filePath: op?.filePath,
          strategy: op?.strategy,
          operationIndex: err.stepIndex,
        };
      });
      return {
        ok: false,
        errors,
      };
    }

    const executions: PreviewV2ExecutionDTO[] = resolvedPlan.executions.map(
      (exec, idx) => ({
        operationIndex: idx,
        executionId: exec.executionId,
        filePath: exec.filePath,
        strategy: exec.strategy,
        targetScope: exec.targetScope,
        beforeExists: exec.beforeExists,
        afterExists: exec.afterExists,
        beforeContent: exec.beforeContent,
        afterContent: exec.afterContent,
        actualDiffHunks: exec.actualDiffHunks,
        beforeFileHash: exec.beforeFileHash,
        afterFileHash: exec.afterFileHash,
      })
    );

    let sessionSummary;
    try {
      const snapshotMap = new Map<string, PreviewV2InitialFileSnapshot>();
      for (const [filePath, fileState] of initialFiles.entries()) {
        const hash = createHash('sha256').update(fileState.content).digest('hex');
        snapshotMap.set(filePath, {
          exists: fileState.exists,
          content: fileState.content,
          hash,
        });
      }

      sessionSummary = sessionStore.createSession(trustedRepoRoot, snapshotMap, executions);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      let code = 'PREVIEW_SESSION_FAILED';
      let message = 'Failed to create preview session.';

      if (errMsg === 'INVALID_REPO_ROOT') {
        code = 'INVALID_REPO_ROOT';
        message = 'Invalid repository root.';
      } else if (errMsg === 'PREVIEW_SESSION_CAPACITY_EXCEEDED') {
        code = 'PREVIEW_SESSION_CAPACITY_EXCEEDED';
        message = 'Preview session capacity exceeded.';
      } else if (errMsg === 'PREVIEW_SESSION_INVALID_PLAN') {
        code = 'PREVIEW_SESSION_INVALID_PLAN';
        message = 'Preview plan is invalid.';
      }

      return {
        ok: false,
        errors: [
          {
            type: 'system',
            code,
            message,
          },
        ],
      };
    }


    return {
      ok: true,
      executions,
      previewToken: sessionSummary.previewToken,
      expiresAt: sessionSummary.expiresAt,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      errors: [
        {
          type: 'system',
          code: 'UNEXPECTED_SYSTEM_ERROR',
          message: 'V2 preview worker failed.',
        },
      ],
    };
  }
}
