import type {
  ApplyPlan,
  IgnoreRules,
  IndexStatus,
  Mode as OperationMode,
  ParsedBlock,
  ValidationError,
} from '@inscribe/shared';

export type AppMode = 'intake' | 'review';

export interface ReviewItem {
  id: string;
  file: string;
  mode: OperationMode;
  language: string;
  lineCount: number;
  status: 'valid' | 'warning' | 'invalid';
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

  // UI state
  isEditing: boolean;
  statusMessage: string;

  // Apply/Undo/Redo state
  lastAppliedPlan: ApplyPlan | null;
  canRedo: boolean;
}
