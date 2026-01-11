import type {
  ApplyPlan,
  ApplyResult,
  IgnoreRules,
  IndexStatus,
  ParseResult,
  ParsedBlock,
  ValidationError,
  UndoResult,
} from '@inscribe/shared';

export interface RepoInitResult {
  topLevelFolders: string[];
  scope: string[];
  ignore: IgnoreRules;
  suggested: string[];
  indexedCount: number;
  indexStatus: IndexStatus;
}

export interface ScopeUpdateResult {
  scope: string[];
  indexedCount: number;
  indexStatus: IndexStatus;
}

export interface IgnoreWriteResult {
  success: boolean;
  error?: string;
  suggested: string[];
  defaultScope: string[];
  topLevelFolders: string[];
  indexedCount: number;
  indexStatus: IndexStatus;
}

export interface ReadIgnoreRawResult {
  content: string;
  path: string;
  exists: boolean;
}

export interface InscribeAPI {
  selectRepository: (defaultPath?: string) => Promise<string | null>;
  getLastVisitedRepo: () => Promise<string | null>;
  repoInit: (repoRoot: string) => Promise<RepoInitResult>;
  getScope: (repoRoot: string) => Promise<string[]>;
  setScope: (repoRoot: string, scope: string[]) => Promise<ScopeUpdateResult>;
  readIgnore: (repoRoot: string) => Promise<IgnoreRules>;
  readIgnoreRaw: (repoRoot: string) => Promise<ReadIgnoreRawResult>;
  writeIgnore: (repoRoot: string, content: string) => Promise<IgnoreWriteResult>;
  indexRepository: (repoRoot: string) => Promise<string[]>;
  indexStatus: (repoRoot: string) => Promise<IndexStatus>;
  parseBlocks: (content: string) => Promise<ParseResult>;
  validateBlocks: (blocks: ParsedBlock[], repoRoot: string) => Promise<ValidationError[]>;
  validateAndBuildApplyPlan: (blocks: ParsedBlock[], repoRoot: string) => Promise<ApplyPlan>;
  applyChanges: (plan: ApplyPlan, repoRoot: string) => Promise<ApplyResult>;
  undoLastApply: (repoRoot: string) => Promise<UndoResult>;
}
