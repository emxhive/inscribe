/**
 * Text manipulation utilities
 */

/**
 * Count lines in content
 */
export function countLines(content: string): number {
  if (!content) return 0;
  return content.split('\n').length;
}

/**
 * Convert first character to uppercase (sentence case)
 */
export function toSentenceCase(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}
