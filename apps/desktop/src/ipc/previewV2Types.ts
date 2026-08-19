import type {
  V2OperationStrategy,
  V2TargetScope,
  V2DiffHunk,
  PreviewV2ErrorDTO,
} from '@inscribe/shared';
import type { v2 } from '@inscribe/engine';

export type { PreviewV2ErrorDTO, PreviewV2ErrorType } from '@inscribe/shared';

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
  blockIndex: number;
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

export type PreviewV2WorkerResponse =
  | {
      ok: true;
      partial: boolean;
      executions: PreviewV2ExecutionDTO[];
      errors: PreviewV2ErrorDTO[];
      previewToken: string;
      expiresAt: string;
    }
  | {
      ok: false;
      errors: PreviewV2ErrorDTO[];
    };
