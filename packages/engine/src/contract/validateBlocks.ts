import {
  DIAGNOSTIC_CODES,
  type DiagnosticCode,
  ParsedBlock,
  ValidationError,
  getRequiredDirectives,
  modeAllowsDirective,
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
  const required = getRequiredDirectives(block.mode);
  for (const key of Object.keys(directives)) {
    if (!modeAllowsDirective(block.mode, key)) {
      errors.push(buildError(block, `Invalid directive ${key} for mode ${block.mode}`, DIAGNOSTIC_CODES.INVALID_DIRECTIVE));
    }
  }
  for (const key of required) {
    if (!directives[key]) {
      errors.push(buildError(block, `Missing required directive ${key} for mode ${block.mode}`, DIAGNOSTIC_CODES.MISSING_DIRECTIVE));
    }
  }

  return errors;
}
