/**
 * Shared types for Inscribe
 */

export type Mode = 'create' | 'replace' | 'append' | 'range' | 'delete';

/**
 * Check if a string is a valid mode
 */
export function isValidMode(mode: string): mode is Mode {
  return (mode === 'create' || mode === 'replace' || mode === 'append' || mode === 'range' || mode === 'delete');
}

export interface ParsedBlock {
  file: string;
  mode: Mode;
  directives: Record<string, string>;
  content: string;
  blockIndex: number;
}

export interface ValidationError {
  blockIndex: number;
  file: string;
  message: string;
}

export interface Operation {
  type: Mode;
  file: string;
  content: string;
  directives?: Record<string, string>;
  blockIndex?: number;
}

export interface OperationPreview {
  type: Mode;
  file: string;
  content: string;
  insert: string;
  replaceStart: number;
  replaceEnd: number;
  removed: string;
}

export interface ApplyPlan {
  operations: Operation[];
  errors?: ValidationError[];
}

export interface ApplyResult {
  success: boolean;
  errors?: string[];
  historyEntries?: HistoryEntry[];
}

export interface HistoryEntry {
  id: string;
  applyId: string;
  file: string;
  mode: Mode;
  createdAt: string;
  restoreOperation: Operation;
  blockIndex?: number;
  restoredAt?: string;
}

export interface ParseResult {
  blocks: ParsedBlock[];
  errors: string[];
}

export type IndexState = 'idle' | 'running' | 'complete' | 'error';

export interface IndexStatus {
  state: IndexState;
  message?: string;
}

export interface IgnoreRules {
  entries: string[];
  source: 'file' | 'none';
  path: string;
}

export interface ScopeState {
  repoRoot: string;
  scope: string[];
  lastSuggested?: string[];
  lastIndexedCount?: number;
  updatedAt: string;
}
