import { V2RawPayload } from '@inscribe/shared';
import { CanonicalExecution } from '../protocol';
import { VirtualFileState } from './virtualFileState';
import { resolveOperation } from './resolveOperation';

export interface ResolvedPlan {
  executions: CanonicalExecution[];
  errors: Array<{ stepIndex: number; message: string }>;
}

export function resolvePlan(
  payloads: V2RawPayload[],
  initialFiles: Map<string, { content: string; exists: boolean }>
): ResolvedPlan {
  const executions: CanonicalExecution[] = [];
  const errors: Array<{ stepIndex: number; message: string }> = [];

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
      const execution = resolveOperation(payload, virtualState);
      executions.push(execution);

      virtualState.set(payload.filePath, {
        content: execution.afterContent,
        exists: execution.afterExists
      });
    } catch (err: any) {
      errors.push({
        stepIndex: i,
        message: err.message || 'Unknown execution error'
      });
      break;
    }
  }

  return {
    executions,
    errors
  };
}
