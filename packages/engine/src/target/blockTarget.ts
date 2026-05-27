import { findBraceRangeFromSelection, formatBraceScanError } from '../util/braceScan';
import { resolveLineLevelAnchors, formatAnchorNotFound, formatAnchorAmbiguous } from './targetUtils';

export function resolveBlockTarget(content: string, directives: Record<string, string>): { replaceStart: number; replaceEnd: number } {
  const contains = directives.START_LINE_CONTAINS;
  const equals = directives.START_LINE_EQUALS;
  const name = contains !== undefined ? 'START_LINE_CONTAINS' : 'START_LINE_EQUALS';
  const value = (contains ?? equals)?.trim();

  if (!value) {
    throw new Error('Missing required START boundary selector (START_LINE_CONTAINS or START_LINE_EQUALS)');
  }

  const strategy = contains !== undefined ? 'contains' : 'equals';
  const matches = resolveLineLevelAnchors(content, value, strategy);

  if (matches.length === 0) throw new Error(formatAnchorNotFound(name, value));
  if (matches.length > 1) throw new Error(formatAnchorAmbiguous(name, matches.length));

  const brace = findBraceRangeFromSelection(content, matches[0].start);
  if (!brace.match) {
    throw new Error(formatBraceScanError(brace.error!));
  }

  return {
    replaceStart: brace.match.openIndex,
    replaceEnd: brace.match.closeIndex + 1,
  };
}
