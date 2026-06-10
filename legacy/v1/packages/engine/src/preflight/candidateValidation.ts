import { resolveValidationAdapter } from '../language/registry';

export function shouldParseValidate(filePath: string): boolean {
  return resolveValidationAdapter(filePath) !== null;
}

export function validateCandidateOrThrow(filePath: string, mode: string, candidate: string, metadata?: Record<string, string>): void {
  if (!shouldParseValidate(filePath)) return;
  const adapter = resolveValidationAdapter(filePath);
  if (!adapter || !adapter.validateCandidate) return;
  try {
    adapter.validateCandidate(filePath, candidate);
  } catch (error) {
    const err = error as Error & { loc?: { line: number; column: number } };
    if (err.message.startsWith('INSCRIBE_PARSE_ERROR')) {
      throw err;
    }
    const line = err.loc?.line ?? -1;
    const column = (err.loc?.column ?? -1) + 1;
    const lines = candidate.split('\n');
    const contextStart = Math.max(1, line - 2);
    const contextEnd = Math.min(lines.length, line + 1);
    const context: string[] = [];
    for (let i = contextStart; i <= contextEnd; i++) {
      context.push(`${i} | ${lines[i - 1] ?? ''}`);
      if (i === line && column > 0) {
        context.push(`    | ${' '.repeat(Math.max(0, column - 1))}^`);
      }
    }
    const meta = Object.entries(metadata ?? {}).map(([k, v]) => `${k}: ${v}`).join('\n');
    throw new Error([
      'INSCRIBE_PARSE_ERROR',
      `File: ${filePath}`,
      `Operation: ${mode}`,
      'Status: blocked_before_write',
      `Line: ${line}`,
      `Column: ${column}`,
      `Message: ${err.message}`,
      meta ? `Metadata:\n${meta}` : '',
      'Context:',
      ...context,
      '',
      'Note:',
      'The patch was applied only to an in-memory candidate.',
      'The real file was not modified.',
    ].filter(Boolean).join('\n'));
  }
}
