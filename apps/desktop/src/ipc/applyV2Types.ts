import type { HistoryEntry } from '@inscribe/shared';

export interface ApplyV2IpcArgs {
  repoRoot: string;
  previewToken: string;
}

export interface ApplyV2WorkerPayload {
  trustedRepoRoot: string;
  previewToken: string;
}

export type ApplyV2ErrorType =
  | 'session'
  | 'workspace'
  | 'apply'
  | 'history'
  | 'system';

export interface ApplyV2ErrorDTO {
  type: ApplyV2ErrorType;
  code: string;
  message: string;
  filePath?: string;
}

export type ApplyV2WorkerResponse =
  | {
      ok: true;
      appliedFileCount: number;
      historyEntries: HistoryEntry[];
    }
  | {
      ok: false;
      errors: ApplyV2ErrorDTO[];
    };
