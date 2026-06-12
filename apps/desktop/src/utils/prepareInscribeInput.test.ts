import { describe, expect, it } from 'vitest';
import { prepareInscribeInput } from './prepareInscribeInput';

describe('prepareInscribeInput', () => {
  it('returns V2 LF input unchanged byte-for-byte', () => {
    const input = '<<<INSCRIBE\nFILE: src/a.ts\nINSCRIBE>>>';
    const result = prepareInscribeInput(input);
    expect(result.protocol).toBe('v2');
    expect(result.parseInput).toBe(input);
    expect(result.normalization).toBeNull();
  });

  it('returns V2 CRLF input unchanged byte-for-byte', () => {
    const input = '<<<INSCRIBE\r\nFILE: src/a.ts\r\nINSCRIBE>>>';
    const result = prepareInscribeInput(input);
    expect(result.protocol).toBe('v2');
    expect(result.parseInput).toBe(input);
    expect(result.normalization).toBeNull();
  });

  it('returns V2 payload containing indentation, blank lines, and trailing spaces unchanged', () => {
    const input = '<<<INSCRIBE  \n  FILE: src/a.ts\n\n  \nINSCRIBE>>>';
    const result = prepareInscribeInput(input);
    expect(result.protocol).toBe('v2');
    expect(result.parseInput).toBe(input);
    expect(result.normalization).toBeNull();
  });

  it('routes malformed V2-looking input with a reserved marker line to V2 unchanged without V1 normalization', () => {
    const input = 'some prose\n<<<CONTENT\nother stuff';
    const result = prepareInscribeInput(input);
    expect(result.protocol).toBe('v2');
    expect(result.parseInput).toBe(input);
    expect(result.normalization).toBeNull();
  });

  it('still uses normalizeInscribeInput() for ordinary V1 input', () => {
    const input = 'some text with $inscribe BEGIN\nFILE: a.ts\n$inscribe END';
    const result = prepareInscribeInput(input);
    expect(result.protocol).toBe('v1');
    expect(result.normalization).not.toBeNull();
    expect(result.parseInput).toBe(result.normalization?.text);
  });
});
