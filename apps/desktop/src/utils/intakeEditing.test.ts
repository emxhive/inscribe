import { describe, expect, it } from 'vitest';
import { parseLiveIntakeStructure } from './liveIntake';
import { removeIntakeBlockFromText } from './intakeEditing';

const block = (file: string, newline = '\n') => [
  '<<<INSCRIBE',
  `FILE: ${file}`,
  'MODE: delete_file',
  'INSCRIBE>>>',
].join(newline);

describe('removeIntakeBlockFromText', () => {
  it('removes a middle block and one adjacent blank separator', () => {
    const input = [block('a.ts'), '', block('b.ts'), '', block('c.ts')].join('\n');
    const selected = parseLiveIntakeStructure(input).blocks[1];

    expect(removeIntakeBlockFromText(input, selected)).toBe([block('a.ts'), '', block('c.ts')].join('\n'));
  });

  it('removes the first block and selects a clean remaining source shape', () => {
    const input = [block('a.ts'), '', block('b.ts')].join('\n');
    const selected = parseLiveIntakeStructure(input).blocks[0];

    expect(removeIntakeBlockFromText(input, selected)).toBe(block('b.ts'));
  });

  it('removes the last block and its preceding separator', () => {
    const input = [block('a.ts'), '', block('b.ts')].join('\n');
    const selected = parseLiveIntakeStructure(input).blocks[1];

    expect(removeIntakeBlockFromText(input, selected)).toBe(`${block('a.ts')}\n`);
  });

  it('removes the only block completely', () => {
    const input = `${block('only.ts')}\n`;
    const selected = parseLiveIntakeStructure(input).blocks[0];

    expect(removeIntakeBlockFromText(input, selected)).toBe('');
  });

  it('preserves CRLF and unrelated prose', () => {
    const newline = '\r\n';
    const input = ['Before', '', block('a.ts', newline), '', 'After'].join(newline);
    const selected = parseLiveIntakeStructure(input).blocks[0];

    expect(removeIntakeBlockFromText(input, selected)).toBe(['Before', '', 'After'].join(newline));
  });

  it('removes an unterminated final block through end of input', () => {
    const input = `Intro\n\n<<<INSCRIBE\nFILE: broken.ts\nMODE: delete_file`;
    const selected = parseLiveIntakeStructure(input).blocks[0];

    expect(removeIntakeBlockFromText(input, selected)).toBe('Intro\n');
  });
});
