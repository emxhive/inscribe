import type {
  IgnoreRules,
  IndexStatus,
  OperationComparison,
  HistoryEntry,
  CliCommandSuggestion,
  OperationStrategy,
  TargetScope,
  PreviewErrorDTO,
  RestorePreview,
} from '@inscribe/shared';

/**
 * Application workflow modes
 * - 'intake': Initial mode where user pastes AI response (corresponds to 'parse' stage in UI)
 * - 'review': Mode where user reviews and applies parsed changes (corresponds to 'review' stage in UI)
 */
export type AppMode = 'intake' | 'review';
export type ReviewView = 'result' | 'unified';
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

export interface ReviewItem extends ReviewItemBase {
  strategy: OperationStrategy;
  executionId: string;
  operationIndex: number;
  blockIndex: number;
  filePath: string;
  targetScope: TargetScope;
}

export type ReviewComparison =
  Omit<OperationComparison, 'type'> & {
    type: OperationComparison['type'] | 'final_file';
  };

export interface ReviewFile {
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

export interface HistoryItem extends HistoryEntry {
}

export interface HistoryReviewState {
  actionId: string | null;
  requestId: string | null;
  selectedEntryId: string | null;
  preview: RestorePreview | null;
  isLoading: boolean;
  isRestoring: boolean;
  error: string | null;
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
  parseWarnings: Array<{ message: string }>;
  previewDiagnostics: PreviewErrorDTO[];
  reviewItems: ReviewItem[];
  reviewFiles: ReviewFile[];
  selectedReviewFileId: string | null;
  selectedIntakeBlockId: string | null;
  selectedIntakeLineIndex: number | null;

  // UI state
  statusMessage: string;
  pipelineStatus: PipelineStatus;
  isParsingInProgress: boolean;
  isApplyingInProgress: boolean;
  isRestoringInProgress: boolean;
  isRestoringRepo: boolean;
  reviewView: ReviewView;
  selectedHunkId: string | null;
  isLeftPanelCollapsed: boolean;
  isRightPanelCollapsed: boolean;
  rightPanelOwner: RightPanelOwner;
  rightPanelView: RightPanelView;
  collapsedHunkIdsByFile: Record<string, string[]>;
  collapsedDiffGroupIdsByFile: Record<string, string[]>;
  isTerminalOpen: boolean;
  terminalCommandSuggestions: CliCommandSuggestion[];
  previewSession: {
    previewToken: string;
    expiresAt: string;
  } | null;
  lastAppliedActionId: string | null;

  // Restore history
  historyItems: HistoryItem[];
  historyReview: HistoryReviewState;
}
