import type {
  OperationStrategy,
  TargetScope,
  DiffHunk,
  PreviewErrorDTO,
} from '@inscribe/shared';
import type { TreeSitterAssetPaths } from '@inscribe/engine';

export type { PreviewErrorDTO, PreviewErrorType } from '@inscribe/shared';

export interface PreviewIpcArgs {
  repoRoot: string;
  rawInput: string;
}

export interface PreviewWorkerPayload {
  trustedRepoRoot: string;
  rawInput: string;
  assetPaths: TreeSitterAssetPaths;
}

export interface PreviewExecutionDTO {
  operationIndex: number;
  blockIndex: number;
  executionId: string;
  filePath: string;
  strategy: OperationStrategy;
  targetScope: TargetScope;
  beforeExists: boolean;
  afterExists: boolean;
  beforeContent: string;
  afterContent: string;
  actualDiffHunks: DiffHunk[];
  beforeFileHash: string;
  afterFileHash: string;
}

export interface PreviewFinalFileDTO {
  filePath: string;
  beforeExists: boolean;
  afterExists: boolean;
  beforeContent: string;
  afterContent: string;
  beforeFileHash: string;
  afterFileHash: string;
  actualDiffHunks: DiffHunk[];
}

export type PreviewWorkerResponse =
  | {
      ok: true;
      partial: boolean;
      executions: PreviewExecutionDTO[];
      finalFiles: PreviewFinalFileDTO[];
      errors: PreviewErrorDTO[];
      previewToken: string;
      expiresAt: string;
    }
  | {
      ok: false;
      errors: PreviewErrorDTO[];
    };
