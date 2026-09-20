import { V2Operation, V2StructuralParserFailure } from '@inscribe/shared';
import { CanonicalExecution } from '../protocol';
import { VirtualFileState } from './virtualFileState';
import { resolveOperation, V2ExecutionContext } from './resolveOperation';

export interface ResolvedPlan {
  executions: CanonicalExecution[];
  executionStepIndices: number[];
  errors: ResolutionFailure[];
  exclusions: ResolutionExclusion[];
}

export interface ResolutionFailure {
  stepIndex: number;
  filePath: string;
  message: string;
  code?: string;
  structuralParser?: V2StructuralParserFailure;
}

export interface ResolutionExclusion {
  stepIndex: number;
  filePath: string;
  message: string;
  blockedByStepIndex: number;
  blockedByMessage: string;
  /**
   * A best-effort diagnostic attempt for the excluded operation. This is not
   * an authoritative failure because it was evaluated against a tainted
   * virtual file state.
   */
  attemptedResolutionMessage?: string;
}

export async function resolvePlan(
  payloads: V2Operation[],
  initialFiles: Map<string, { content: string; exists: boolean }>,
  context: V2ExecutionContext = {}
): Promise<ResolvedPlan> {
  const executions: CanonicalExecution[] = [];
  const executionStepIndices: number[] = [];
  const errors: ResolutionFailure[] = [];
  const exclusions: ResolutionExclusion[] = [];
  const taintedFiles = new Map<string, ResolutionFailure>();

  const virtualState: VirtualFileState = new Map();
  for (const [filePath, item] of initialFiles.entries()) {
    virtualState.set(filePath, {
      content: item.content,
      exists: item.exists
    });
  }

  for (let i = 0; i < payloads.length; i++) {
    const payload = payloads[i];
    
    if (!virtualState.has(payload.filePath)) {
      virtualState.set(payload.filePath, {
        content: '',
        exists: false
      });
    }

    try {
      const execution = await resolveOperation(payload, virtualState, context);

      const blockingFailure = taintedFiles.get(payload.filePath);
      if (blockingFailure) {
        exclusions.push({
          stepIndex: i,
          filePath: payload.filePath,
          message: `Excluded because an earlier operation for ${payload.filePath} failed.`,
          blockedByStepIndex: blockingFailure.stepIndex,
          blockedByMessage: blockingFailure.message,
        });
        continue;
      }

      executions.push(execution);
      executionStepIndices.push(i);

      virtualState.set(payload.filePath, {
        content: execution.afterContent,
        exists: execution.afterExists
      });
    } catch (err: unknown) {
      const error = err as {
        message?: unknown;
        code?: unknown;
        structuralParser?: unknown;
      };
      const failure: ResolutionFailure = {
        stepIndex: i,
        filePath: payload.filePath,
        message: typeof error.message === 'string' ? error.message : 'Unknown execution error',
        code: typeof error.code === 'string' ? error.code : undefined,
        structuralParser: isStructuralParserFailure(error.structuralParser)
          ? error.structuralParser
          : undefined,
      };

      const blockingFailure = taintedFiles.get(payload.filePath);
      if (blockingFailure) {
        exclusions.push({
          stepIndex: i,
          filePath: payload.filePath,
          message: `Excluded because an earlier operation for ${payload.filePath} failed.`,
          blockedByStepIndex: blockingFailure.stepIndex,
          blockedByMessage: blockingFailure.message,
          attemptedResolutionMessage: failure.message,
        });
        continue;
      }

      errors.push(failure);
      taintedFiles.set(payload.filePath, failure);
    }
  }
  return {
    executions,
    executionStepIndices,
    errors,
    exclusions,
  };
}

function isStructuralParserFailure(value: unknown): value is V2StructuralParserFailure {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<V2StructuralParserFailure>;
  return (
    candidate.parser === 'tree-sitter' &&
    typeof candidate.adapterId === 'string' &&
    typeof candidate.grammarId === 'string' &&
    Array.isArray(candidate.diagnostics)
  );
}
