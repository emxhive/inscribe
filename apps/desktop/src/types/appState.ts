import type {
  ApplyPlan,
  IgnoreRules,
  IndexStatus,
  Mode as OperationMode,
  ParsedBlock,
  ValidationError,
} from '@inscribe/shared';

/**
 * Application workflow modes
 * - 'intake': Initial mode where user pastes AI response (corresponds to 'parse' stage in UI)
 * - 'review': Mode where user reviews and applies parsed changes (corresponds to 'review' stage in UI)
 */
export type AppMode = 'intake' | 'review';

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

export interface AppState {
  // Repository state
  repoRoot: string | null;
  topLevelFolders: string[];
  scope: string[];
  ignore: IgnoreRules;
  suggested: string[];
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
  isIntakeMaximized: boolean;
  isReviewMaximized: boolean;
  isRestoringRepo: boolean;

  // Apply/Undo/Redo state
  lastAppliedPlan: ApplyPlan | null;
  canRedo: boolean;
}
