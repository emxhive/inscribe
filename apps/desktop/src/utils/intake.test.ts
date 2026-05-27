import { describe, expect, it } from 'vitest';
import { parseIntakeStructure } from './intake';

const wrapBlock = (body: string) => `$inscribe BEGIN\n${body}\n$inscribe END`;

describe('parseIntakeStructure', () => {
  it('warns when create_file targets an indexed file', () => {
    const input = wrapBlock(`FILE: src/existing.ts\nMODE: create_file`);
    const { blocks } = parseIntakeStructure(input, {
      indexedFileSet: new Set(['src/existing.ts']),
    });

    expect(blocks[0].warnings).toContain(
      'MODE=create_file targets an existing indexed file: src/existing.ts'
    );
  });

  it('warns when replace_file targets a non-indexed file', () => {
    const input = wrapBlock(`FILE: src/missing.ts\nMODE: replace_file`);
    const { blocks } = parseIntakeStructure(input, {
      indexedFileSet: new Set(['src/other.ts']),
    });

    expect(blocks[0].warnings).toContain(
      'MODE=replace_file targets a file that is not indexed: src/missing.ts'
    );
  });

  it('accepts START/END variants for replace_range mode structural checks', () => {
    const input = wrapBlock(
      `FILE: src/range.ts\nMODE: replace_range\nSTART_LINE_CONTAINS: // start\nEND_LINE_EQUALS: // end`
    );
    const { blocks } = parseIntakeStructure(input);

    expect(blocks[0].warnings).not.toContain('Missing START boundary selector for replace_range mode');
  });

  it('accepts START_LINE_CONTAINS for replace_line without warnings', () => {
    const input = wrapBlock(`FILE: src/range.ts\nMODE: replace_line\nSTART_LINE_CONTAINS: // start`);
    const { blocks } = parseIntakeStructure(input);

    expect(blocks[0].warnings).not.toContain('Missing START boundary selector for replace_line mode');
  });
});
