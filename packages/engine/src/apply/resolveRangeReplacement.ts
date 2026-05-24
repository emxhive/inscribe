import { Operation } from '@inscribe/shared';
import { resolveReplaceBetween, resolveReplaceBlock, resolveReplaceLine, resolveReplaceRange } from '../range/resolveRange';

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
  const directives = operation.directives || {};
  const resolved = operation.type === 'replace_line' ? resolveReplaceLine(content, directives) : operation.type === 'replace_range' ? resolveReplaceRange(content, directives) : operation.type === 'replace_between' ? resolveReplaceBetween(content, directives) : operation.type === 'replace_block' ? resolveReplaceBlock(content, directives) : (() => { throw new Error(`Unsupported partial replacement mode: ${operation.type}`); })();
  const { replaceStart, replaceEnd } = resolved;

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
