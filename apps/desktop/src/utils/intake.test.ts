import { describe, expect, it } from 'vitest';
import { parseIntakeStructure } from './intake';

const wrapBlock = (body: string) => `@inscribe BEGIN\n${body}\n@inscribe END`;

describe('parseIntakeStructure', () => {
  it('warns when create targets an indexed file', () => {
    const input = wrapBlock(`FILE: src/existing.ts\nMODE: create`);
    const { blocks } = parseIntakeStructure(input, {
      indexedFileSet: new Set(['src/existing.ts']),
    });

    expect(blocks[0].warnings).toContain(
      'MODE=create targets an existing indexed file: src/existing.ts'
    );
  });

  it('warns when replace targets a non-indexed file', () => {
    const input = wrapBlock(`FILE: src/missing.ts\nMODE: replace`);
    const { blocks } = parseIntakeStructure(input, {
      indexedFileSet: new Set(['src/other.ts']),
    });

    expect(blocks[0].warnings).toContain(
      'MODE=replace targets a file that is not indexed: src/missing.ts'
    );
  });

  it('accepts START/END variants for range mode structural checks', () => {
    const input = wrapBlock(
      `FILE: src/range.ts\nMODE: range\nSTART_AFTER: // start\nEND_BEFORE: // end`
    );
    const { blocks } = parseIntakeStructure(input);

    expect(blocks[0].warnings).not.toContain('Missing START directive for range mode');
    expect(blocks[0].warnings).not.toContain('Missing END directive for range mode');
  });
});
