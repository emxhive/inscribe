import { Operation } from '@inscribe/shared';
import { resolveRange } from '../range/resolveRange';

export interface RangeReplaceResolution {
  replaceStart: number;
  replaceEnd: number;
  insert: string;
  removed: string;
  prefix: string;
  suffix: string;
}

export function resolveRangeReplacement(
  content: string,
  operation: Operation
): RangeReplaceResolution {
  const { replaceStart, replaceEnd } = resolveRange(content, operation.directives || {});

  const suffix = content.substring(replaceEnd);
  const insert = normalizeLineInsert(operation.content, suffix);
  const prefix = content.substring(0, replaceStart);
  const removed = content.substring(replaceStart, replaceEnd);

  return {
    replaceStart,
    replaceEnd,
    insert,
    removed,
    prefix,
    suffix,
  };
}

function normalizeLineInsert(insert: string, suffix: string): string {
  if (!suffix) return insert;         // nothing after -> don't force a newline
  if (!insert) return insert;         // empty insert -> leave it alone
  return insert.endsWith('\n') ? insert : insert + '\n';
}
