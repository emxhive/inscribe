import type { ParsedBlock, ValidationError } from '@inscribe/shared';
import type { ReviewItem } from './useAppState';

/**
 * Determine language from file extension
 */
export function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    rb: 'ruby',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    php: 'php',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sh: 'bash',
    sql: 'sql',
  };
  
  return languageMap[ext] || ext || 'text';
}

/**
 * Count lines in content
 */
export function countLines(content: string): number {
  if (!content) return 0;
  return content.split('\n').length;
}

/**
 * Build review items from parsed blocks and validation errors
 */
export function buildReviewItems(
  blocks: ParsedBlock[],
  validationErrors: ValidationError[]
): ReviewItem[] {
  // Create a map of blockIndex to validation errors
  const errorMap = new Map<number, ValidationError[]>();
  for (const error of validationErrors) {
    const errors = errorMap.get(error.blockIndex) || [];
    errors.push(error);
    errorMap.set(error.blockIndex, errors);
  }

  return blocks.map((block) => {
    const errors = errorMap.get(block.blockIndex) || [];
    const hasErrors = errors.length > 0;
    const validationError = hasErrors ? errors.map((e) => e.message).join('; ') : undefined;

    return {
      id: `${block.blockIndex}-${block.file}`,
      file: block.file,
      mode: block.mode,
      language: getLanguageFromFilename(block.file),
      lineCount: countLines(block.content),
      status: hasErrors ? 'invalid' : 'valid',
      originalContent: block.content,
      editedContent: block.content,
      validationError,
      blockIndex: block.blockIndex,
      directives: block.directives,
    };
  });
}

/**
 * Normalize path to use forward slashes
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * Get the last segment of a path (basename)
 */
export function getPathBasename(path: string): string {
  const normalized = normalizePath(path);
  const segments = normalized.split('/').filter(Boolean);
  return segments[segments.length - 1] || '';
}

/**
 * Convert first character to uppercase (sentence case)
 */
export function toSentenceCase(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Build an apply plan from review items
 */
export function buildApplyPlanFromItems(items: ReviewItem[]) {
  return {
    operations: items.map((item) => ({
      type: item.mode,
      file: item.file,
      content: item.editedContent,
      directives: item.directives,
    })),
  };
}
