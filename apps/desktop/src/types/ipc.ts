import type {
  ApplyPlan,
  ApplyResult,
  IgnoreRules,
  IndexStatus,
  Operation,
  OperationComparison,
  ParseResult,
  ParsedBlock,
  ValidationError,
  HistoryEntry,
} from '@inscribe/shared';

export interface RepoInitResult {
  topLevelFolders: string[];
  scope: string[];
  ignore: IgnoreRules;
  suggested: string[];
  indexedFiles: string[];
  indexedCount: number;
  indexStatus: IndexStatus;
}

export interface ScopeUpdateResult {
  scope: string[];
  indexedFiles: string[];
  indexedCount: number;
  indexStatus: IndexStatus;
}

export interface IgnoreWriteResult {
  success: boolean;
  error?: string;
  suggested: string[];
  defaultScope: string[];
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

export interface TerminalSessionInfo {
  sessionId: string;
  cwd: string;
  shell: string;
  shellPreference: TerminalShellPreference;
}

export type TerminalShellPreference = 'auto' | 'bash' | 'powershell' | 'cmd';

export interface TerminalDataEvent {
  sessionId: string;
  runId: string | null;
  data: string;
}

export type TerminalRunExitReason = 'exited' | 'interrupted' | 'terminated' | 'session-exit' | 'disposed';

export interface TerminalRunExitEvent {
  sessionId: string;
  runId: string;
  exitCode: number | null;
  cwd?: string;
  reason?: TerminalRunExitReason;
}

export interface TerminalSessionExitEvent {
  sessionId: string;
  exitCode: number | null;
  reason: 'exited' | 'terminated' | 'disposed';
}

export type TerminalSignalKind = 'interrupt' | 'eof' | 'terminate';

export interface InscribeAPI {
  selectRepository: (defaultPath?: string) => Promise<string | null>;
  getLastVisitedRepo: () => Promise<string | null>;
  repoInit: (repoRoot: string) => Promise<RepoInitResult>;
  openRepository: (repoRoot: string) => Promise<void>;
  getRecentProjects: () => Promise<string[]>;
  getWindowRepo: () => Promise<string | null>;
  onOpenRepo: (callback: (repoRoot: string) => void) => () => void;
  onRecentProjectsUpdated: (callback: (projects: string[]) => void) => () => void;
  getScope: (repoRoot: string) => Promise<string[]>;
  setScope: (repoRoot: string, scope: string[]) => Promise<ScopeUpdateResult>;
  readIgnore: (repoRoot: string) => Promise<IgnoreRules>;
  readIgnoreRaw: (repoRoot: string) => Promise<ReadIgnoreRawResult>;
  writeIgnore: (repoRoot: string, content: string) => Promise<IgnoreWriteResult>;
  indexRepository: (repoRoot: string) => Promise<string[]>;
  indexStatus: (repoRoot: string) => Promise<IndexStatus>;
  parseBlocks: (content: string) => Promise<ParseResult>;
  validateBlocks: (blocks: ParsedBlock[]) => Promise<ValidationError[]>;
  validateAndBuildApplyPlan: (blocks: ParsedBlock[]) => Promise<ApplyPlan>;
  applyChanges: (plan: ApplyPlan, repoRoot: string) => Promise<ApplyResult>;
  compareOperation: (operation: Operation, repoRoot: string) => Promise<OperationComparisonResult>;
  getHistoryEntries: (repoRoot: string) => Promise<HistoryEntry[]>;
  markHistoryEntryRestored: (repoRoot: string, entryId: string, restoredAt: string) => Promise<boolean>;
  terminalCreate: (options: TerminalCreateOptions) => Promise<TerminalSessionInfo>;
  terminalRunCommand: (sessionId: string, runId: string, command: string) => Promise<boolean>;
  terminalWrite: (sessionId: string, data: string) => Promise<boolean>;
  terminalResize: (sessionId: string, cols: number, rows: number) => Promise<boolean>;
  terminalSignal: (sessionId: string, kind: TerminalSignalKind) => Promise<boolean>;
  terminalInterrupt: (sessionId: string) => Promise<boolean>;
  terminalDispose: (sessionId: string) => Promise<boolean>;
  onTerminalData: (callback: (event: TerminalDataEvent) => void) => () => void;
  onTerminalRunExit: (callback: (event: TerminalRunExitEvent) => void) => () => void;
  onTerminalSessionExit: (callback: (event: TerminalSessionExitEvent) => void) => () => void;
}
