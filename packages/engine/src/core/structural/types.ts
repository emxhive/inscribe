import { StructuralKind, StructuralSelectorSegment, StructuralSelector } from '@inscribe/shared';
import {
  StructuralCandidate,
  FLUTTER_STRUCTURAL_KINDS,
  STRUCTURAL_KINDS,
  isStructuralKind,
} from '../languages/types';
export { StructuralKind, StructuralSelectorSegment, StructuralSelector };
export {
  STRUCTURAL_KINDS,
  FLUTTER_STRUCTURAL_KINDS,
  isStructuralKind,
};
export type { StructuralCandidate } from '../languages/types';

export type StructuralNodeMatch = StructuralCandidate;
