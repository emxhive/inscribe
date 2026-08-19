import { V2Operation } from '@inscribe/shared';
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
    } catch (err: any) {
      const failure: ResolutionFailure = {
        stepIndex: i,
        filePath: payload.filePath,
        message: err.message || 'Unknown execution error'
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
