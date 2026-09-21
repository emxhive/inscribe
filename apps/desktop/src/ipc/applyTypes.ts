import type { HistoryEntry } from '@inscribe/shared';

export interface ApplyIpcArgs {
  repoRoot: string;
  previewToken: string;
}

export interface ApplyWorkerPayload {
  trustedRepoRoot: string;
  previewToken: string;
}

export type ApplyErrorType =
  | 'session'
  | 'workspace'
  | 'apply'
  | 'history'
  | 'system';

export interface ApplyErrorDTO {
  type: ApplyErrorType;
  code: string;
  message: string;
  filePath?: string;
}

export type ApplyWorkerResponse =
  | {
      ok: true;
      appliedFileCount: number;
      historyEntries: HistoryEntry[];
    }
  | {
      ok: false;
      errors: ApplyErrorDTO[];
    };
