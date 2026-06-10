export type StructuralKind = 'class' | 'method' | 'function' | 'if_statement';

export interface StructuralSelectorSegment {
  kind: StructuralKind;
  name?: string;
}

export interface StructuralSelector {
  path: StructuralSelectorSegment[];
  startsWith?: string;
}

export interface StructuralNodeMatch {
  kind: StructuralKind;
  name?: string;
  start: number;
  end: number;
}
