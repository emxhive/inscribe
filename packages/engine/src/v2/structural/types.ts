import { StructuralKind, StructuralSelectorSegment, StructuralSelector } from '@inscribe/shared';
export { StructuralKind, StructuralSelectorSegment, StructuralSelector };

export interface StructuralNodeMatch {
  kind: StructuralKind;
  name?: string;
  start: number;
  end: number;
}
