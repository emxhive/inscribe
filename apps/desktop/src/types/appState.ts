import type {
  ApplyPlan,
  IgnoreRules,
  IndexStatus,
  Mode as OperationMode,
  OperationComparison,
  ParsedBlock,
  ValidationError,
  HistoryEntry,
  CliCommandSuggestion,
  ParseWarning,
  V2OperationStrategy,
  V2TargetScope,
  PreviewV2ErrorDTO,
} from '@inscribe/shared';

/**
 * Application workflow modes
 * - 'intake': Initial mode where user pastes AI response (corresponds to 'parse' stage in UI)
 * - 'review': Mode where user reviews and applies parsed changes (corresponds to 'review' stage in UI)
 */
export type AppMode = 'intake' | 'review';
export type ReviewView = 'result' | 'unified' | 'edit';
export type RightPanelOwner = 'inspector' | 'history';
export type RightPanelView = 'properties' | 'diagnostics';

export type PipelineStatus = 
  | 'idle'
  | 'parsing'
  | 'parse-success'
  | 'parse-partial'
  | 'parse-failure'
  | 'applying'
  | 'apply-success'
  | 'apply-failure';

interface ReviewItemBase {
  id: string;
  file: string;
  language: string;
  lineCount: number;
  status: 'pending' | 'applied' | 'invalid';
  validationError?: string;
}

export interface V1ReviewItem extends ReviewItemBase {
  engineVersion?: undefined;
  mode: OperationMode;
  originalContent: string;
  editedContent: string;
  blockIndex: number;
  directives: Record<string, string>;
}

export interface V2ReviewItem extends ReviewItemBase {
  engineVersion: 'v2';
  strategy: V2OperationStrategy;
  executionId: string;
  operationIndex: number;
  blockIndex: number;
  filePath: string;
  targetScope: V2TargetScope;
}

export type ReviewItem = V1ReviewItem | V2ReviewItem;

export type ReviewPreflightStatus = 'checking' | 'passed' | 'failed';

export interface ReviewPreflightResult {
  status: ReviewPreflightStatus;
  fingerprint: string;
  error?: string;
}

export type ReviewComparison =
  Omit<OperationComparison, 'type'> & {
    type: OperationComparison['type'] | 'v2_final_file';
  };

export interface ReviewComparisonSnapshot {
  fingerprint: string;
  comparison: ReviewComparison;
}

export interface V2ReviewFile {
  id: string;
  filePath: string;
  language: string;
  beforeExists: boolean;
  afterExists: boolean;
  beforeFileHash: string;
  afterFileHash: string;
  comparison: ReviewComparison;
  operationIds: string[];
}

export type RestoreStatus =
  | 'idle'
  | 'restoring'
  | 'success'
  | 'validation-failed'
  | 'apply-failed'
  | 'unsafe';

export interface HistoryItem extends HistoryEntry {
  restoreStatus?: RestoreStatus;
  restoreMessage?: string;
  restoreMeta?: {
    file: string;
    lineCount: number;
    language: string;
    mode: OperationMode;
  };
}

export interface AppState {
  // Repository state
  repoRoot: string | null;
  topLevelFolders: string[];
  ignore: IgnoreRules;
  suggested: string[];
  indexedFiles: string[];
  indexedFileSet: Set<string>;
  indexedCount: number;
  indexStatus: IndexStatus;

  // Parsing/Review state
  mode: AppMode;
  aiInput: string;
  parseErrors: string[];
  parseWarnings: ParseWarning[];
  v2PreviewDiagnostics: PreviewV2ErrorDTO[];
  parsedBlocks: ParsedBlock[];
  validationErrors: ValidationError[];
  reviewItems: ReviewItem[];
  selectedItemId: string | null;
  v2ReviewFiles: V2ReviewFile[];
  selectedV2FileId: string | null;
  selectedIntakeBlockId: string | null;
  selectedIntakeLineIndex: number | null;

  // UI state
  isEditing: boolean;
  statusMessage: string;
  pipelineStatus: PipelineStatus;
  isParsingInProgress: boolean;
  isApplyingInProgress: boolean;
  isRestoringInProgress: boolean;
  isRestoringRepo: boolean;
  reviewView: ReviewView;
  selectedHunkId: string | null;
  reviewComparisonError: string | null;
  reviewPreflightByItem: Record<string, ReviewPreflightResult>;
  reviewComparisonByItem: Record<string, ReviewComparisonSnapshot>;
  isLeftPanelCollapsed: boolean;
  isRightPanelCollapsed: boolean;
  rightPanelOwner: RightPanelOwner;
  rightPanelView: RightPanelView;
  collapsedHunkIdsByItem: Record<string, string[]>;
  collapsedHunkIdsByFile: Record<string, string[]>;
  collapsedDiffGroupIdsByItem: Record<string, string[]>;
  collapsedDiffGroupIdsByFile: Record<string, string[]>;
  isTerminalOpen: boolean;
  terminalCommandSuggestions: CliCommandSuggestion[];
  terminalSuggestionSourceApplyId: string | null;

  // Apply/Redo state
  lastAppliedPlan: ApplyPlan | null;
  canRedo: boolean;
  lastApplyId: string | null;
  canUndoApply: boolean;

  v2PreviewSession: {
    previewToken: string;
    expiresAt: string;
  } | null;

  // Restore history
  historyItems: HistoryItem[];
}
