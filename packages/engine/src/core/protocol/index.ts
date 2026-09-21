import {
  OperationStrategy,
  RawPayload,
  NormalizedPayload,
  TargetScope,
  DiffHunk
} from '@inscribe/shared';

export interface CanonicalExecution {
  executionId: string;
  filePath: string;
  strategy: OperationStrategy;
  targetScope: TargetScope;
  rawPayload: RawPayload;
  normalizedPayload: NormalizedPayload;
  beforeExists: boolean;
  afterExists: boolean;
  beforeContent: string;
  afterContent: string;
  actualDiffHunks: DiffHunk[];
  beforeFileHash: string;
  afterFileHash: string;
}

export * from './parseInscribeBlocks';
export * from './protocolErrors';
