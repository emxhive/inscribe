import * as fs from 'fs';
import { Operation } from '@shared';
import { findAllOccurrences } from '../util/textSearch';

/**
 * Apply range replace operation
 */
export function applyRangeReplace(filePath: string, operation: Operation): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { START, END, SCOPE_START, SCOPE_END } = operation.directives || {};

  if (!START || !END) {
    throw new Error('Range operation requires START and END directives');
  }

  if ((SCOPE_START && !SCOPE_END) || (!SCOPE_START && SCOPE_END)) {
    throw new Error('Both SCOPE_START and SCOPE_END must be provided together');
  }

  let searchContent = content;
  let searchOffset = 0;

  if (SCOPE_START && SCOPE_END) {
    const scopeStartMatches = findAllOccurrences(content, SCOPE_START);
    const scopeEndMatches = findAllOccurrences(content, SCOPE_END);

    if (scopeStartMatches.length === 0) {
      throw new Error(`SCOPE_START anchor not found: "${SCOPE_START}"`);
    }

    if (scopeEndMatches.length === 0) {
      throw new Error(`SCOPE_END anchor not found: "${SCOPE_END}"`);
    }

    if (scopeStartMatches.length > 1) {
      throw new Error(`SCOPE_START anchor matches multiple times (${scopeStartMatches.length}), must match exactly once`);
    }

    if (scopeEndMatches.length > 1) {
      throw new Error(`SCOPE_END anchor matches multiple times (${scopeEndMatches.length}), must match exactly once`);
    }

    const scopeStartPos = scopeStartMatches[0];
    const scopeEndPos = scopeEndMatches[0];

    if (scopeStartPos >= scopeEndPos) {
      throw new Error('SCOPE_END must come after SCOPE_START');
    }

    searchContent = content.substring(scopeStartPos, scopeEndPos + SCOPE_END.length);
    searchOffset = scopeStartPos;
  }

  const startMatches = findAllOccurrences(searchContent, START);
  const endMatches = findAllOccurrences(searchContent, END);

  if (startMatches.length === 0) {
    throw new Error(`START anchor not found: "${START}"`);
  }

  if (endMatches.length === 0) {
    throw new Error(`END anchor not found: "${END}"`);
  }

  if (startMatches.length > 1) {
    throw new Error(`START anchor matches multiple times (${startMatches.length}), must match exactly once`);
  }

  if (endMatches.length > 1) {
    throw new Error(`END anchor matches multiple times (${endMatches.length}), must match exactly once`);
  }

  const startPos = startMatches[0];
  const endPos = endMatches[0];

  if (startPos >= endPos) {
    throw new Error('END anchor must come after START anchor');
  }

  const absoluteStartPos = searchOffset + startPos + START.length;
  const absoluteEndPos = searchOffset + endPos;

  const newContent =
    content.substring(0, absoluteStartPos) +
    operation.content +
    content.substring(absoluteEndPos);

  fs.writeFileSync(filePath, newContent);
}
