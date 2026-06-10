import { describe, it, expect } from 'vitest';
import { detectDestinationEOL, normalizeLineEndings } from '../../src/v2/execution/normalizeLineEndings';
import { resolveOperation } from '../../src/v2/execution/resolveOperation';
import { hashContent } from '../../src/v2/execution/virtualFileState';

describe('V2 Line Ending Normalization', () => {
  it('detects CRLF for file containing only CRLF', () => {
    const file = 'line1\r\nline2\r\n';
    const payload = 'line3\n';
    expect(detectDestinationEOL(file, payload)).toBe('\r\n');
  });

  it('detects LF for file containing only LF', () => {
    const file = 'line1\nline2\n';
    const payload = 'line3\r\n';
    expect(detectDestinationEOL(file, payload)).toBe('\n');
  });

  it('detects majority ending for mixed file (majority CRLF)', () => {
    const file = 'line1\r\nline2\r\nline3\n';
    const payload = 'line4\n';
    expect(detectDestinationEOL(file, payload)).toBe('\r\n');
  });

  it('detects majority ending for mixed file (majority LF)', () => {
    const file = 'line1\nline2\nline3\r\n';
    const payload = 'line4\r\n';
    expect(detectDestinationEOL(file, payload)).toBe('\n');
  });

  it('resolves tie in mixed file by using the first encountered newline (LF first)', () => {
    const file = 'line1\nline2\r\n';
    const payload = 'line3\r\n';
    expect(detectDestinationEOL(file, payload)).toBe('\n');
  });

  it('resolves tie in mixed file by using the first encountered newline (CRLF first)', () => {
    const file = 'line1\r\nline2\n';
    const payload = 'line3\n';
    expect(detectDestinationEOL(file, payload)).toBe('\r\n');
  });

  it('falls back to payload first newline style when file contains no newline (CRLF payload)', () => {
    const file = 'nonewline';
    const payload = 'line1\r\nline2';
    expect(detectDestinationEOL(file, payload)).toBe('\r\n');
  });

  it('falls back to payload first newline style when file contains no newline (LF payload)', () => {
    const file = 'nonewline';
    const payload = 'line1\nline2';
    expect(detectDestinationEOL(file, payload)).toBe('\n');
  });

  it('defaults to LF when neither file nor payload contains newlines', () => {
    const file = 'nonewline';
    const payload = 'nopayloadnewline';
    expect(detectDestinationEOL(file, payload)).toBe('\n');
  });

  it('normalizes payloads through CRLF -> LF -> selected EOL', () => {
    const input = 'a\r\nb\rc\nd';
    expect(normalizeLineEndings(input, '\n')).toBe('a\nb\nc\nd');
    expect(normalizeLineEndings(input, '\r\n')).toBe('a\r\nb\r\nc\r\nd');
  });

  it('preserves CRLF line endings when LF SEARCH and LF replacement are applied to CRLF file with one line edit', () => {
    const fileContent = 'line 1\r\nline 2\r\nline 3\r\n';
    const virtualState = new Map([
      ['file.txt', { content: fileContent, exists: true }]
    ]);
    const payload = {
      strategy: 'replace_text' as const,
      filePath: 'file.txt',
      content: 'line 2 changed\n',
      directives: { SEARCH: 'line 2\n' }
    };

    const execution = resolveOperation(payload, virtualState);

    expect(execution.afterContent).toBe('line 1\r\nline 2 changed\r\nline 3\r\n');
    expect(execution.actualDiffHunks.length).toBe(1);
    expect(execution.actualDiffHunks[0].oldText).toBe('line 2\r\n');
    expect(execution.actualDiffHunks[0].newText).toBe('line 2 changed\r\n');
  });

  it('preserves CRLF line endings with zero diff hunks when CRLF file has identical replacement with LF SEARCH/payload', () => {
    const fileContent = 'line 1\r\nline 2\r\nline 3\r\n';
    const virtualState = new Map([
      ['file.txt', { content: fileContent, exists: true }]
    ]);
    const payload = {
      strategy: 'replace_text' as const,
      filePath: 'file.txt',
      content: 'line 2\n',
      directives: { SEARCH: 'line 2\n' }
    };

    const execution = resolveOperation(payload, virtualState);

    expect(execution.afterContent).toBe('line 1\r\nline 2\r\nline 3\r\n');
    expect(execution.actualDiffHunks.length).toBe(0);
  });
});
