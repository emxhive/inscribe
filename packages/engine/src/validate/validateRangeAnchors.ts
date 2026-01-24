import * as fs from 'fs';

import { findEnclosingBraceRange, formatBraceScanError } from '../util/braceScan';
import { findAllOccurrences, MatchRange } from '../util/textSearch';
import {ParsedBlock, ValidationError} from "@inscribe/shared";


/**
 * Validate range mode anchors
 */
export function validateRangeAnchors(
  block: ParsedBlock,
  filePath: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  const directives = block.directives ?? {};
  const startKeys = ['START', 'START_BEFORE', 'START_AFTER'] as const;
  const endKeys = ['END', 'END_BEFORE', 'END_AFTER'] as const;

  const startDirectives = startKeys
    .map(key => ({ key, value: directives[key] }))
    .filter(entry => entry.value);
  const endDirectives = endKeys
    .map(key => ({ key, value: directives[key] }))
    .filter(entry => entry.value);

  if (startDirectives.length === 0) {
    errors.push({
      blockIndex: block.blockIndex,
      file: block.file,
      message: 'MODE: range requires exactly one of START, START_BEFORE, START_AFTER directives',
    });
  }

  if (errors.length > 0) {
    return errors;
  }

  if (startDirectives.length > 1) {
    errors.push({
      blockIndex: block.blockIndex,
      file: block.file,
      message: 'Multiple START directives provided; use only one of START, START_BEFORE, START_AFTER',
    });
  }

  if (endDirectives.length > 1) {
    errors.push({
      blockIndex: block.blockIndex,
      file: block.file,
      message: 'Multiple END directives provided; use only one of END, END_BEFORE, END_AFTER',
    });
  }

  if (errors.length > 0) {
    return errors;
  }

  // Read file content
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check for SCOPE if provided
  let searchContent = content;
  const hasScopeStart = Boolean(directives.SCOPE_START);
  const hasScopeEnd = Boolean(directives.SCOPE_END);
  if (hasScopeStart !== hasScopeEnd) {
    errors.push({
      blockIndex: block.blockIndex,
      file: block.file,
      message: 'SCOPE_START and SCOPE_END must be provided together',
    });
    return errors;
  }

  if (directives.SCOPE_START && directives.SCOPE_END) {
    const scopeStartMatches = findAllOccurrences(content, directives.SCOPE_START);
    const scopeEndMatches = findAllOccurrences(content, directives.SCOPE_END);

    if (scopeStartMatches.length === 0) {
      errors.push({
        blockIndex: block.blockIndex,
        file: block.file,
        message: `SCOPE_START anchor not found: "${directives.SCOPE_START}"`,
      });
    }

    if (scopeEndMatches.length === 0) {
      errors.push({
        blockIndex: block.blockIndex,
        file: block.file,
        message: `SCOPE_END anchor not found: "${directives.SCOPE_END}"`,
      });
    }

    if (scopeStartMatches.length > 1) {
      errors.push({
        blockIndex: block.blockIndex,
        file: block.file,
        message: `SCOPE_START anchor matches multiple times (${scopeStartMatches.length}), must match exactly once`,
      });
    }

    if (errors.length > 0) {
      return errors;
    }

    const scopeStartMatch = scopeStartMatches[0];
    const scopeEndMatch = findFirstMatchAfter(scopeEndMatches, scopeStartMatch);
    if (!scopeEndMatch) {
      errors.push({
        blockIndex: block.blockIndex,
        file: block.file,
        message: 'SCOPE_END anchor not found after SCOPE_START',
      });
      return errors;
    }

    searchContent = content.substring(scopeStartMatch.start, scopeEndMatch.end);
  }

  // Validate START and END anchors
  const startDirective = startDirectives[0];
  const startAnchor = startDirective.value;
  
  if (!startAnchor) {
    // This should never happen due to earlier checks
    return errors;
  }

  const startMatches = findAllOccurrences(searchContent, startAnchor);

  if (startMatches.length === 0) {
    errors.push({
      blockIndex: block.blockIndex,
      file: block.file,
      message: `${startDirective.key} anchor not found: "${startAnchor}"`,
    });
  }

  if (startMatches.length > 1) {
    errors.push({
      blockIndex: block.blockIndex,
      file: block.file,
      message: `${startDirective.key} anchor matches multiple times (${startMatches.length}), must match exactly once`,
    });
  }

  if (errors.length > 0) {
    return errors;
  }

  if (endDirectives.length === 1) {
    const endDirective = endDirectives[0];
    const endAnchor = endDirective.value;
    if (!endAnchor) {
      return errors;
    }
    if (endDirective.key === 'END' && endAnchor === '}') {
      const startMatch = startMatches[0];
      const anchorIndex = Math.max(startMatch.end - 1, startMatch.start);
      const braceResult = findEnclosingBraceRange(searchContent, anchorIndex);
      if (braceResult.error) {
        errors.push({
          blockIndex: block.blockIndex,
          file: block.file,
          message: formatBraceScanError(braceResult.error),
        });
      }
    } else {
      const endMatches = findAllOccurrences(searchContent, endAnchor);

      if (endMatches.length === 0) {
        errors.push({
          blockIndex: block.blockIndex,
          file: block.file,
          message: `${endDirective.key} anchor not found: "${endAnchor}"`,
        });
      }

      if (errors.length > 0) {
        return errors;
      }

      const startMatch = startMatches[0];
      const endMatch = findFirstMatchAfter(endMatches, startMatch);

      if (!endMatch) {
        errors.push({
          blockIndex: block.blockIndex,
          file: block.file,
          message: `${endDirective.key} anchor not found after ${startDirective.key}`,
        });
      }
    }
  }

  return errors;
}

function findFirstMatchAfter(matches: MatchRange[], startMatch: MatchRange): MatchRange | undefined {
  return matches.find(match => match.start >= startMatch.end);
}
