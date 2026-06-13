import type {
  V2OperationStrategy,
  V2TargetScope,
  V2DiffHunk,
} from '@inscribe/shared';
import type { v2 } from '@inscribe/engine';

export interface PreviewV2IpcArgs {
  repoRoot: string;
  rawInput: string;
}

export interface PreviewV2WorkerPayload {
  trustedRepoRoot: string;
  rawInput: string;
  assetPaths: v2.TreeSitterAssetPaths;
}

export interface PreviewV2ExecutionDTO {
  operationIndex: number;
  executionId: string;
  filePath: string;
  strategy: V2OperationStrategy;
  targetScope: V2TargetScope;
  beforeExists: boolean;
  afterExists: boolean;
  beforeContent: string;
  afterContent: string;
  actualDiffHunks: V2DiffHunk[];
  beforeFileHash: string;
  afterFileHash: string;
}

export type PreviewV2ErrorType = 'protocol' | 'workspace' | 'resolution' | 'system';

export interface PreviewV2ErrorDTO {
  type: PreviewV2ErrorType;
  code: string;
  message: string;
  filePath?: string;
  strategy?: string;
  operationIndex?: number;
  blockIndex?: number;
  line?: number;
  context?: string;
}

export type PreviewV2WorkerResponse =
  | {
      ok: true;
      executions: PreviewV2ExecutionDTO[];
      previewToken: string;
      expiresAt: string;
    }
  | {
      ok: false;
      errors: PreviewV2ErrorDTO[];
    };
