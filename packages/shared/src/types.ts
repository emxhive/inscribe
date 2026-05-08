/**
 * Shared types for Inscribe
 */

export type Mode = 'create' | 'replace' | 'append' | 'range' | 'delete' | 'replace_symbol';

/**
 * Check if a string is a valid mode
 */
export function isValidMode(mode: string): mode is Mode {
  return (mode === 'create' || mode === 'replace' || mode === 'append' || mode === 'range' || mode === 'delete' || mode === 'replace_symbol');
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

/**
 * Half-open character offsets into a document string.
 */
export interface ComparisonRange {
  start: number;
  end: number;
}

export type ComparisonRegionKind = 'insert' | 'delete' | 'replace';

/**
 * Indicates how a zero-width deletion marker should attach to surviving content.
 */
export type ComparisonAnchorSide = 'before' | 'after' | 'empty';

export interface ComparisonBoundary {
  oldOffset: number;
  newOffset: number;
}

/**
 * Deterministic placement metadata for rendering deleted content that no longer
 * exists in the new document.
 */
export interface ComparisonRenderAnchor {
  oldOffset: number;
  newOffset: number;
  side: ComparisonAnchorSide;
}

/**
 * Canonical, operation-aware change region used by review. The exact changed
 * spans live in oldRange/newRange, while boundaries and renderAnchor preserve a
 * deterministic placement model for zero-width insert/delete rendering.
 */
export interface OperationComparisonRegion {
  id: string;
  kind: ComparisonRegionKind;
  oldRange: ComparisonRange;
  newRange: ComparisonRange;
  oldText: string;
  newText: string;
  boundaries: {
    before: ComparisonBoundary;
    after: ComparisonBoundary;
  };
  /**
   * Future review overlays can compare only this region without re-diffing the
   * entire document.
   */
  compare: {
    oldRange: ComparisonRange;
    newRange: ComparisonRange;
  };
  renderAnchor: ComparisonRenderAnchor;
}

/**
 * Engine-owned source of truth for review. The engine decides old/new content
 * and supplies exact, deterministic change regions that the UI can render.
 */
export interface OperationComparison {
  type: Mode;
  file: string;
  oldContent: string;
  newContent: string;
  regions: OperationComparisonRegion[];
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

export interface RestoreWindow {
  preContext: string;
  postContext: string;
}

export interface RestorePayloadV2 {
  schemaVersion: 2;
  mode: Mode;
  file: string;
  oldContent: string;
  newContent: string;
  baseFileHash: string;
  appliedFileHash: string;
  oldContentHash: string;
  newContentHash: string;
  oldSpanStart: number;
  oldSpanEnd: number;
  newSpanStart: number;
  newSpanEnd: number;
  window: RestoreWindow;
}

export interface HistoryEntry {
  id: string;
  applyId: string;
  file: string;
  mode: Mode;
  createdAt: string;
  restoreOperation: Operation;
  restorePayload?: RestorePayloadV2;
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
