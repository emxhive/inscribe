import { v2 } from '@inscribe/engine';
import { loadInitialFilesRecovering } from './previewV2Workspace';
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
 * and sequential plan resolution on the worker. Attributable failures are
 * collected while independent and later operations continue to preview.
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
    const parsed = v2.parseInscribeBlocksRecovering(rawInput);
    const errors: PreviewV2ErrorDTO[] = parsed.diagnostics.map((diagnostic) => ({
      type: 'protocol',
      code: diagnostic.code,
      message: diagnostic.message,
      blockIndex: diagnostic.blockIndex,
      line: diagnostic.line,
      lineKind: typeof diagnostic.line === 'number' ? 'exact' : undefined,
      context: diagnostic.context,
      filePath: diagnostic.filePath,
    }));

    const filePaths = Array.from(new Set(parsed.operations.map(({ operation }) => operation.filePath)));
    const workspace = loadInitialFilesRecovering(trustedRepoRoot, filePaths);
    if (workspace.fatalError) {
      return {
        ok: false,
        errors: [{
          type: 'workspace',
          code: workspace.fatalError.code,
          message: workspace.fatalError.message,
          filePath: workspace.fatalError.filePath,
        }],
      };
    }

        const failedPaths = new Set(workspace.errors.map((error) => error.filePath).filter(Boolean) as string[]);
    const previewable = parsed.operations.filter(({ operation }) => !failedPaths.has(operation.filePath));
    const protocolBlockerByStepIndex = new Map<number, (typeof parsed.diagnostics)[number]>();
    for (let stepIndex = 0; stepIndex < previewable.length; stepIndex++) {
      const source = previewable[stepIndex];
      const blocker = parsed.diagnostics.find(
        (diagnostic) =>
          diagnostic.filePath === source.operation.filePath &&
          typeof diagnostic.blockIndex === 'number' &&
          diagnostic.blockIndex < source.blockIndex,
      );
      if (blocker) {
        protocolBlockerByStepIndex.set(stepIndex, blocker);
      }
    }

    for (const workspaceError of workspace.errors) {
      const affected = parsed.operations.filter(({ operation }) => operation.filePath === workspaceError.filePath);
      if (affected.length === 0) {
        errors.push({
          type: 'workspace',
          code: workspaceError.code,
          message: workspaceError.message,
          filePath: workspaceError.filePath,
        });
        continue;
      }
      for (const source of affected) {
        const operationIndex = previewable.indexOf(source);
        errors.push({
          type: 'workspace',
          code: workspaceError.code,
          message: workspaceError.message,
          filePath: workspaceError.filePath,
          strategy: source.operation.strategy,
          operationIndex: operationIndex >= 0 ? operationIndex : undefined,
          blockIndex: source.blockIndex,
          line: source.startLine,
          lineKind: 'block',
        });
      }
    }

    const operations = previewable.map(({ operation }) => operation);
    const initialFiles = workspace.initialFiles;

    if (operations.length === 0) {
      return {
        ok: false,
        errors: errors.length > 0 ? errors : [{
          type: 'system',
          code: 'NO_PREVIEWABLE_OPERATIONS',
          message: 'No V2 operations could be previewed.',
        }],
      };
    }

    const structuralResolver = v2.createStructuralResolver(assetPaths);
    const resolvedPlan = await v2.resolvePlan(operations, initialFiles, {
      structuralResolver,
    });

        const addProtocolDependencyBlocked = (
      stepIndex: number,
      attemptedResolutionMessage?: string,
    ): boolean => {
      const source = previewable[stepIndex];
      const blocker = protocolBlockerByStepIndex.get(stepIndex);
      if (!source || !blocker || typeof blocker.blockIndex !== 'number') {
        return false;
      }

      const dependencyMessage = `Excluded because earlier protocol-invalid block ${blocker.blockIndex + 1} for ${source.operation.filePath} made the expected virtual file state uncertain.`;
      errors.push({
        type: 'resolution',
        code: 'DEPENDENCY_BLOCKED',
        message: attemptedResolutionMessage
          ? `${dependencyMessage} Best-effort resolution also reported: ${attemptedResolutionMessage}`
          : dependencyMessage,
        filePath: source.operation.filePath,
        strategy: source.operation.strategy,
        operationIndex: stepIndex,
        blockIndex: source.blockIndex,
        line: source.startLine,
        lineKind: 'uncertain',
        blockedByBlockIndex: blocker.blockIndex,
        context: blocker.message,
      });
      return true;
    };

    for (const resolutionError of resolvedPlan.errors) {
      if (addProtocolDependencyBlocked(resolutionError.stepIndex, resolutionError.message)) {
        continue;
      }

      const source = previewable[resolutionError.stepIndex];
      errors.push({
        type: 'resolution',
        code: mapResolutionError(resolutionError.message),
        message: resolutionError.message,
        filePath: source?.operation.filePath,
        strategy: source?.operation.strategy,
        operationIndex: resolutionError.stepIndex,
        blockIndex: source?.blockIndex,
        line: source?.startLine,
        lineKind: source ? 'block' : undefined,
      });
    }

    for (const exclusion of resolvedPlan.exclusions) {
      const source = previewable[exclusion.stepIndex];
      const blockingSource = previewable[exclusion.blockedByStepIndex];
      const protocolBlocker = protocolBlockerByStepIndex.get(exclusion.stepIndex);
      if (
        protocolBlocker &&
        typeof protocolBlocker.blockIndex === 'number' &&
        (!blockingSource || protocolBlocker.blockIndex < blockingSource.blockIndex)
      ) {
        addProtocolDependencyBlocked(exclusion.stepIndex, exclusion.attemptedResolutionMessage);
        continue;
      }

      errors.push({
        type: 'resolution',
        code: 'DEPENDENCY_BLOCKED',
        message: exclusion.attemptedResolutionMessage
          ? `${exclusion.message} Best-effort resolution also reported: ${exclusion.attemptedResolutionMessage}`
          : exclusion.message,
        filePath: source?.operation.filePath ?? exclusion.filePath,
        strategy: source?.operation.strategy,
        operationIndex: exclusion.stepIndex,
        blockIndex: source?.blockIndex,
        line: source?.startLine,
        lineKind: source ? 'uncertain' : undefined,
        blockedByOperationIndex: exclusion.blockedByStepIndex,
        blockedByBlockIndex: blockingSource?.blockIndex,
        context: exclusion.blockedByMessage,
      });
    }

    const executions: PreviewV2ExecutionDTO[] = resolvedPlan.executions.flatMap(
      (exec, idx) => {
        const stepIndex = resolvedPlan.executionStepIndices[idx];
        if (addProtocolDependencyBlocked(stepIndex)) {
          return [];
        }

        return [{
          operationIndex: stepIndex,
          blockIndex: previewable[stepIndex]?.blockIndex ?? idx,
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
        }];
      },
    );

    if (executions.length === 0) {
      return {
        ok: false,
        errors: errors.length > 0 ? errors : [{
          type: 'system',
          code: 'NO_PREVIEWABLE_OPERATIONS',
          message: 'No V2 operations could be previewed.',
        }],
      };
    }

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
      partial: errors.length > 0,
      executions,
      errors,
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
