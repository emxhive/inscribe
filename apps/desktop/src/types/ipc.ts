import type {
  ApplyPlan,
  ApplyResult,
  AppliedAiInputRecord,
  IgnoreRules,
  IndexStatus,
  Operation,
  OperationComparison,
  ParseResult,
  ParsedBlock,
  ValidationError,
  HistoryEntry,
  V2RestorePreview,
} from '@inscribe/shared';
import type { PreviewV2IpcArgs, PreviewV2WorkerResponse } from '../ipc/previewV2Types';
import type { ApplyV2IpcArgs, ApplyV2WorkerResponse } from '../ipc/applyV2Types';

export interface RepoInitResult {
  topLevelFolders: string[];
  ignore: IgnoreRules;
  suggested: string[];
  indexedFiles: string[];
  indexedCount: number;
  indexStatus: IndexStatus;
}

export interface IgnoreWriteResult {
  success: boolean;
  error?: string;
  suggested: string[];
  topLevelFolders: string[];
  indexedFiles: string[];
  indexedCount: number;
  indexStatus: IndexStatus;
}

export interface ReadIgnoreRawResult {
  content: string;
  path: string;
  exists: boolean;
}

export type OperationComparisonResult = OperationComparison | { error: string };

export interface TerminalCreateOptions {
  cwd: string;
  cols: number;
  rows: number;
  shellPreference?: TerminalShellPreference;
}

export type TerminalShellKind = 'powershell' | 'cmd' | 'posix';

export interface TerminalSessionInfo {
  sessionId: string;
  cwd: string;
  shell: string;
  shellKind: TerminalShellKind;
  shellPreference: TerminalShellPreference;
}

export type TerminalShellPreference = 'auto' | 'bash' | 'powershell' | 'cmd';

export type OpenRepositoryTarget = 'auto' | 'same-window' | 'new-window';

export interface TerminalDataEvent {
  sessionId: string;
  data: string;
}

export interface TerminalSessionExitEvent {
  sessionId: string;
  exitCode: number | null;
  reason: 'exited' | 'terminated' | 'disposed';
}

export interface InscribeAPI {
  selectRepository: (defaultPath?: string) => Promise<string | null>;
  getLastVisitedRepo: () => Promise<string | null>;
  repoInit: (repoRoot: string) => Promise<RepoInitResult>;
  openRepository: (repoRoot: string, target?: OpenRepositoryTarget) => Promise<void>;
  getRecentProjects: () => Promise<string[]>;
  getWindowRepo: () => Promise<string | null>;
  getAppliedAiInput: (rawInput: string, repoRoot: string) => Promise<AppliedAiInputRecord | null>;
  confirmPreviouslyAppliedAiInputParse: (record: AppliedAiInputRecord) => Promise<boolean>;
  readClipboardText: () => Promise<string>;
  selectMarkdownFile: () => Promise<{ path: string; content: string } | null>;
  onOpenRepo: (callback: (repoRoot: string) => void) => () => void;
  onRecentProjectsUpdated: (callback: (projects: string[]) => void) => () => void;
  readIgnore: (repoRoot: string) => Promise<IgnoreRules>;
  readIgnoreRaw: (repoRoot: string) => Promise<ReadIgnoreRawResult>;
  writeIgnore: (repoRoot: string, content: string) => Promise<IgnoreWriteResult>;
  indexRepository: (repoRoot: string) => Promise<string[]>;
  indexStatus: (repoRoot: string) => Promise<IndexStatus>;
  parseBlocks: (content: string) => Promise<ParseResult>;
  validateBlocks: (blocks: ParsedBlock[]) => Promise<ValidationError[]>;
  validateAndBuildApplyPlan: (blocks: ParsedBlock[]) => Promise<ApplyPlan>;
  applyChanges: (plan: ApplyPlan, repoRoot: string, rawAiInput?: string) => Promise<ApplyResult>;
  restoreEntry: (request: import('@inscribe/engine').RestoreRequest, repoRoot: string) => Promise<ApplyResult>;
  compareOperation: (operation: Operation, repoRoot: string) => Promise<OperationComparisonResult>;
  getHistoryEntries: (repoRoot: string) => Promise<HistoryEntry[]>;
  markHistoryEntryRestored: (repoRoot: string, entryId: string, restoredAt: string) => Promise<boolean>;
  previewV2Restore: (repoRoot: string, actionId: string) => Promise<V2RestorePreview>;
  restoreV2Action: (repoRoot: string, actionId: string) => Promise<ApplyResult>;
  terminalCreate: (options: TerminalCreateOptions) => Promise<TerminalSessionInfo>;
  terminalWrite: (sessionId: string, data: string) => Promise<boolean>;
  terminalResize: (sessionId: string, cols: number, rows: number) => Promise<boolean>;
  terminalDispose: (sessionId: string) => Promise<boolean>;
  onTerminalData: (callback: (event: TerminalDataEvent) => void) => () => void;
  onTerminalSessionExit: (callback: (event: TerminalSessionExitEvent) => void) => () => void;
  previewV2: (args: PreviewV2IpcArgs) => Promise<PreviewV2WorkerResponse>;
  applyV2: (args: ApplyV2IpcArgs) => Promise<ApplyV2WorkerResponse>;
}
