import type { ApplyResult, IgnoreRules, IndexStatus, HistoryEntry, RestorePreview } from '@inscribe/shared';
import type { PreviewIpcArgs, PreviewWorkerResponse } from '../ipc/previewTypes';
import type { ApplyIpcArgs, ApplyWorkerResponse } from '../ipc/applyTypes';

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
  removeRecentProject: (repoRoot: string) => Promise<string[]>;
  getWindowRepo: () => Promise<string | null>;
  readClipboardText: () => Promise<string>;
  selectMarkdownFile: () => Promise<{ path: string; content: string } | null>;
  onOpenRepo: (callback: (repoRoot: string) => void) => () => void;
  onRecentProjectsUpdated: (callback: (projects: string[]) => void) => () => void;
  readIgnore: (repoRoot: string) => Promise<IgnoreRules>;
  readIgnoreRaw: (repoRoot: string) => Promise<ReadIgnoreRawResult>;
  writeIgnore: (repoRoot: string, content: string) => Promise<IgnoreWriteResult>;
  indexRepository: (repoRoot: string) => Promise<string[]>;
  indexStatus: (repoRoot: string) => Promise<IndexStatus>;
  getHistoryEntries: (repoRoot: string) => Promise<HistoryEntry[]>;
  previewRestore: (repoRoot: string, actionId: string) => Promise<RestorePreview>;
  restoreAction: (repoRoot: string, actionId: string) => Promise<ApplyResult>;
  terminalCreate: (options: TerminalCreateOptions) => Promise<TerminalSessionInfo>;
  terminalWrite: (sessionId: string, data: string) => Promise<boolean>;
  terminalResize: (sessionId: string, cols: number, rows: number) => Promise<boolean>;
  terminalDispose: (sessionId: string) => Promise<boolean>;
  onTerminalData: (callback: (event: TerminalDataEvent) => void) => () => void;
  onTerminalSessionExit: (callback: (event: TerminalSessionExitEvent) => void) => () => void;
  preview: (args: PreviewIpcArgs) => Promise<PreviewWorkerResponse>;
  apply: (args: ApplyIpcArgs) => Promise<ApplyWorkerResponse>;
}
