import { ParsedBlock, modeRequiresContent } from '@inscribe/shared';
import { parseDirectives } from './parseDirectives';
import { extractFencedBlock } from './parseFencedBlock';

export interface BlockParseResult { block?: ParsedBlock; error?: string; warnings?: string[]; }

export function parseSingleBlock(lines: string[], blockIndex: number): BlockParseResult {
  const directiveResult = parseDirectives(lines);
  if (directiveResult.error) return { error: directiveResult.error };
  const { file, mode, directives, contentStartIndex, warnings } = directiveResult;

  if (!modeRequiresContent(mode)) {
    if (contentStartIndex >= 0) return { error: `${mode} does not allow fenced content` };
    return { block: { file, mode, directives, content: '', blockIndex }, warnings };
  }

  const fencedResult = extractFencedBlock(lines, contentStartIndex, { requireTrailingWhitespace: true });
  if (fencedResult.error) return { error: fencedResult.error };
  return { block: { file, mode, directives, content: fencedResult.content ?? '', blockIndex }, warnings };
}
