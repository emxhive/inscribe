import { StructuralKind, StructuralSelectorSegment, StructuralSelector } from '@inscribe/shared';
import {
  StructuralCandidate,
  FLUTTER_STRUCTURAL_KINDS,
  V2_STRUCTURAL_KINDS,
  isV2StructuralKind,
} from '../languages/types';
export { StructuralKind, StructuralSelectorSegment, StructuralSelector };
export {
  V2_STRUCTURAL_KINDS,
  FLUTTER_STRUCTURAL_KINDS,
  isV2StructuralKind,
};
export type { StructuralCandidate } from '../languages/types';

export type StructuralNodeMatch = StructuralCandidate;
