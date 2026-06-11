import {
  V2OperationStrategy,
  V2RawPayload,
  V2NormalizedPayload,
  V2TargetScope,
  V2DiffHunk
} from '@inscribe/shared';

export interface CanonicalExecution {
  executionId: string;
  filePath: string;
  strategy: V2OperationStrategy;
  targetScope: V2TargetScope;
  rawPayload: V2RawPayload;
  normalizedPayload: V2NormalizedPayload;
  beforeExists: boolean;
  afterExists: boolean;
  beforeContent: string;
  afterContent: string;
  actualDiffHunks: V2DiffHunk[];
  beforeFileHash: string;
  afterFileHash: string;
}

export * from './parseInscribeBlocks';
export * from './protocolErrors';
