import { V2OperationStrategy } from './operations';

export type StructuralKind =
  | 'class'
  | 'method'
  | 'function'
  | 'if_statement';

export interface StructuralSelectorSegment {
  kind: StructuralKind;
  name?: string;
}

export interface StructuralSelector {
  path: StructuralSelectorSegment[];
  startsWith?: string;
}

export interface StructuralRange {
  start: number;
  end: number;
}

export interface V2MatchMetadata {
  kind: 'exact' | 'fallback';
  score?: number;
  resolvedRange: { start: number; end: number };
  fallbackReason?: 'exact_not_found';
  unmatchedSoftTokens?: string[];
}

export interface V2TargetScope {
  filePath: string;
  strategy: V2OperationStrategy;
  selector?: StructuralSelector;
  selectorText?: string;
  lineRange?: { startLine: number; endLine: number };
  beforeRange?: StructuralRange;
  afterRange?: StructuralRange;
  matchMetadata?: V2MatchMetadata;
}

