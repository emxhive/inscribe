import { describe, expect, it } from 'vitest';
import { DIRECTIVE_KEYS } from '@inscribe/shared';
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

  it('accepts explicit boundary selectors for replace_range mode structural checks', () => {
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

  it('uses only active directives for UI add-directive sources', () => {
    expect([...DIRECTIVE_KEYS]).toEqual([
      'START_LINE_CONTAINS',
      'START_LINE_EQUALS',
      'END_LINE_CONTAINS',
      'END_LINE_EQUALS',
      'END_OCCURRENCE',
      'RANGE_CONTAINS',
      'RANGE_LINE_CONTAINS_ALL',
      'NAME',
    ]);
  });

  it('aggregates repeated RANGE_LINE_CONTAINS_ALL directives in intake structure', () => {
    const input = wrapBlock([
      'FILE: src/range.ts',
      'MODE: replace_range',
      'START_LINE_CONTAINS: // start',
      'END_LINE_CONTAINS: // end',
      'RANGE_LINE_CONTAINS_ALL: id, status',
      'RANGE_LINE_CONTAINS_ALL: role, enabled',
    ].join('\n'));
    const { blocks } = parseIntakeStructure(input);

    expect(blocks[0].directives.RANGE_LINE_CONTAINS_ALL?.value).toBe('id, status\nrole, enabled');
  });

  it.each([
    ['START', 'START is no longer supported. Use START_LINE_CONTAINS or START_LINE_EQUALS.'],
    ['END', 'END is no longer supported. Use END_LINE_CONTAINS or END_LINE_EQUALS.'],
    ['CONTAINS', 'CONTAINS is no longer supported. Use RANGE_CONTAINS.'],
  ])('reports pasted legacy %s directives as migration errors', (key, message) => {
    const input = wrapBlock(`FILE: src/range.ts\nMODE: replace_line\n${key}: marker`);
    const { blocks, lines } = parseIntakeStructure(input);

    expect(blocks[0].errors).toContain(message);
    expect(lines.find((line) => line.text.startsWith(`${key}:`))?.status).toBe('error');
  });
});
