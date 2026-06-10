import {
  DIAGNOSTIC_CODES,
  type DiagnosticCode,
  ParsedBlock,
  ValidationError,
  getRequiredDirectives,
  getAllowedDirectives,
  modeAllowsEmptyContent,
  modeRequiresContent,
} from '@inscribe/shared';

function buildError(
  block: Pick<ParsedBlock, 'blockIndex' | 'file'>,
  message: string,
  code?: DiagnosticCode,
): ValidationError {
  return { blockIndex: block.blockIndex, file: block.file, message, code };
}

/**
 * Performs static contract validation of parsed blocks.
 * Does not read the filesystem or perform preflight.
 * Strict: unaware of RESTORE_* internal directives.
 */
export function validateBlocks(blocks: ParsedBlock[]): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const block of blocks) {
    errors.push(...validateBlock(block));
  }
  return errors;
}

function validateBlock(block: ParsedBlock): ValidationError[] {
  const errors: ValidationError[] = [];
  const directives = block.directives ?? {};

  // Content policies
  if (modeRequiresContent(block.mode) && !modeAllowsEmptyContent(block.mode) && block.content.length === 0) {
    errors.push(buildError(block, `${block.mode} does not allow empty content`, DIAGNOSTIC_CODES.EMPTY_CONTENT_NOT_ALLOWED));
  }

  // Directive policies
  const allowed = getAllowedDirectives(block.mode);
  for (const key of Object.keys(directives)) {
    if (!allowed.includes(key)) {
      errors.push(buildError(block, `Invalid directive ${key} for mode ${block.mode}`, DIAGNOSTIC_CODES.INVALID_DIRECTIVE));
    }
  }

  const endOccurrence = directives.END_OCCURRENCE;
  if (endOccurrence !== undefined && !/^[1-9]\d*$/.test(endOccurrence.trim())) {
    errors.push(buildError(block, `END_OCCURRENCE must be a positive integer`, DIAGNOSTIC_CODES.INVALID_DIRECTIVE));
  }

  const rangeLineContainsAll = directives.RANGE_LINE_CONTAINS_ALL;
  if (rangeLineContainsAll !== undefined) {
    for (const value of rangeLineContainsAll.split('\n')) {
      const fragments = value.split(',').map((fragment) => fragment.trim());
      if (fragments.length === 0 || fragments.some((fragment) => fragment.length === 0)) {
        errors.push(buildError(block, `RANGE_LINE_CONTAINS_ALL must be a comma-separated list of non-empty fragments`, DIAGNOSTIC_CODES.INVALID_DIRECTIVE));
        break;
      }
    }
  }

  // Boundary specific validation
  if (['replace_line', 'replace_range', 'replace_between', 'replace_block'].includes(block.mode)) {
    const startContains = directives.START_LINE_CONTAINS;
    const startEquals = directives.START_LINE_EQUALS;
    if (startContains === undefined && startEquals === undefined) {
      errors.push(buildError(block, `Missing required START boundary selector (START_LINE_CONTAINS or START_LINE_EQUALS) for mode ${block.mode}`, DIAGNOSTIC_CODES.MISSING_DIRECTIVE));
    }
    if (startContains !== undefined && startEquals !== undefined) {
      errors.push(buildError(block, `Cannot use both START_LINE_CONTAINS and START_LINE_EQUALS`, DIAGNOSTIC_CODES.INVALID_DIRECTIVE));
    }

    if (['replace_range', 'replace_between'].includes(block.mode)) {
      const endContains = directives.END_LINE_CONTAINS;
      const endEquals = directives.END_LINE_EQUALS;
      if (endContains === undefined && endEquals === undefined) {
        errors.push(buildError(block, `Missing required END boundary selector (END_LINE_CONTAINS or END_LINE_EQUALS) for mode ${block.mode}`, DIAGNOSTIC_CODES.MISSING_DIRECTIVE));
      }
      if (endContains !== undefined && endEquals !== undefined) {
        errors.push(buildError(block, `Cannot use both END_LINE_CONTAINS and END_LINE_EQUALS`, DIAGNOSTIC_CODES.INVALID_DIRECTIVE));
      }
    }
  }

  const required = getRequiredDirectives(block.mode);
  for (const key of required) {
    if (!directives[key]) {
      errors.push(buildError(block, `Missing required directive ${key} for mode ${block.mode}`, DIAGNOSTIC_CODES.MISSING_DIRECTIVE));
    }
  }

  return errors;
}
