import { describe, expect, it } from 'vitest';
import { detectInscribeProtocol } from './detectInscribeProtocol';

describe('detectInscribeProtocol', () => {
  it('routes valid V2 marker to v2', () => {
    const input = '<<<INSCRIBE\nFILE: a.ts\nMODE: replace_file\n<<<CONTENT\nhello\nCONTENT>>>\nINSCRIBE>>>';
    expect(detectInscribeProtocol(input)).toBe('v2');
  });

  it('routes malformed V2-looking input containing any reserved V2 marker to v2', () => {
    const input = 'some prose\n<<<CONTENT\nother stuff';
    expect(detectInscribeProtocol(input)).toBe('v2');
  });

  it('handles lone CR line endings', () => {
    const input = '<<<INSCRIBE\rFILE: a.ts\rINSCRIBE>>>';
    expect(detectInscribeProtocol(input)).toBe('v2');
  });

  it('routes ordinary prose to v1', () => {
    const input = 'This is ordinary prose explaining how something works.';
    expect(detectInscribeProtocol(input)).toBe('v1');
  });

  it('routes V1 marker input to v1', () => {
    const input = 'some text with $inscribe BEGIN and $inscribe END';
    expect(detectInscribeProtocol(input)).toBe('v1');
  });

  it('marker substring inside code does not route to v2', () => {
    const input = 'const x = "something <<<INSCRIBE inside code";';
    expect(detectInscribeProtocol(input)).toBe('v1');
  });
});
