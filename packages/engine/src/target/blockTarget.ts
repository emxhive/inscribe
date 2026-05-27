import { findBraceRangeFromSelection, formatBraceScanError } from '../util/braceScan';
import { resolveBoundarySelector, formatAnchorNotFound, formatAnchorAmbiguous } from './targetUtils';

export function resolveBlockTarget(content: string, directives: Record<string, string>): { replaceStart: number; replaceEnd: number } {
  const start = resolveBoundarySelector(content, directives, 'START');

  if (start.matches.length === 0) throw new Error(formatAnchorNotFound(start.name, start.value));
  if (start.matches.length > 1) throw new Error(formatAnchorAmbiguous(start.name, start.matches.length));

  const brace = findBraceRangeFromSelection(content, start.matches[0].start);
  if (!brace.match) {
    throw new Error(formatBraceScanError(brace.error!));
  }

  return {
    replaceStart: brace.match.openIndex,
    replaceEnd: brace.match.closeIndex + 1,
  };
}
