import type {
  ApplyPlan,
  IgnoreRules,
  IndexStatus,
  Mode as OperationMode,
  ParsedBlock,
  ValidationError,
  HistoryEntry,
} from '@inscribe/shared';

/**
 * Application workflow modes
 * - 'intake': Initial mode where user pastes AI response (corresponds to 'parse' stage in UI)
 * - 'review': Mode where user reviews and applies parsed changes (corresponds to 'review' stage in UI)
 */
export type AppMode = 'intake' | 'review';
export type OverlayEditor = AppMode | null;

export type PipelineStatus = 
  | 'idle'
  | 'parsing'
  | 'parse-success'
  | 'parse-failure'
  | 'applying'
  | 'apply-success'
  | 'apply-failure';

export interface ReviewItem {
  id: string;
  file: string;
  mode: OperationMode;
  language: string;
  lineCount: number;
  status: 'pending' | 'applied' | 'invalid';
  originalContent: string;
  editedContent: string;
  validationError?: string;
  blockIndex: number;
  directives: Record<string, string>;
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
  scope: string[];
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
  parsedBlocks: ParsedBlock[];
  validationErrors: ValidationError[];
  reviewItems: ReviewItem[];
  selectedItemId: string | null;
  selectedIntakeBlockId: string | null;

  // UI state
  isEditing: boolean;
  statusMessage: string;
  pipelineStatus: PipelineStatus;
  isParsingInProgress: boolean;
  isApplyingInProgress: boolean;
  isRestoringInProgress: boolean;
  isRestoringRepo: boolean;
  overlayEditor: OverlayEditor;
  isHistoryOpen: boolean;

  // Apply/Redo state
  lastAppliedPlan: ApplyPlan | null;
  canRedo: boolean;

  // Restore history
  historyItems: HistoryItem[];
}
