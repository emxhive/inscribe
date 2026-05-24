import { findBraceRangeFromSelection, formatBraceScanError } from '../util/braceScan';
import { resolveAnchors, formatAnchorNotFound, formatAnchorAmbiguous } from './targetUtils';

export function resolveBlockTarget(content: string, directives: Record<string, string>): { replaceStart: number; replaceEnd: number } {
  const start = directives.START?.trim();
  if (!start) throw new Error('Missing required START directive');

  const matches = resolveAnchors(content, start);
  if (matches.length === 0) throw new Error(formatAnchorNotFound('START', start));
  if (matches.length > 1) throw new Error(formatAnchorAmbiguous('START', matches.length));

  const brace = findBraceRangeFromSelection(content, matches[0].start);
  if (!brace.match) {
    throw new Error(formatBraceScanError(brace.error!));
  }

  return {
    replaceStart: brace.match.openIndex,
    replaceEnd: brace.match.closeIndex + 1,
  };
}
