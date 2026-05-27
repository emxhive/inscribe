import { describe, expect, it } from 'vitest';
import {
  ALL_FIELD_KEYS,
  DIRECTIVE_KEYS,
  LEGACY_DIRECTIVE_KEYS,
  type DirectiveKey,
} from '@inscribe/shared';
import { parseBlocks } from '../src/parse/parseBlocks';

const blockWith = (directive: string) => `$inscribe BEGIN
FILE: src/example.ts
MODE: replace_line
${directive}: marker
\`\`\`
replacement
\`\`\`
$inscribe END`;

describe('directive contract', () => {
  it('exposes only active directives in public directive keys', () => {
    const active: DirectiveKey[] = [...DIRECTIVE_KEYS];

    expect(active).toEqual([
      'START_LINE_CONTAINS',
      'START_LINE_EQUALS',
      'END_LINE_CONTAINS',
      'END_LINE_EQUALS',
      'RANGE_CONTAINS',
      'NAME',
    ]);
    expect(DIRECTIVE_KEYS).not.toContain('START');
    expect(DIRECTIVE_KEYS).not.toContain('END');
    expect(DIRECTIVE_KEYS).not.toContain('CONTAINS');
    expect(ALL_FIELD_KEYS).not.toContain('START');
    expect(ALL_FIELD_KEYS).not.toContain('END');
    expect(ALL_FIELD_KEYS).not.toContain('CONTAINS');
    expect(LEGACY_DIRECTIVE_KEYS).toEqual(['START', 'END', 'CONTAINS']);
  });

  it.each([
    ['START', 'START is no longer supported. Use START_LINE_CONTAINS or START_LINE_EQUALS.'],
    ['END', 'END is no longer supported. Use END_LINE_CONTAINS or END_LINE_EQUALS.'],
    ['CONTAINS', 'CONTAINS is no longer supported. Use RANGE_CONTAINS.'],
  ])('reports a migration error for legacy %s without parsing a block', (key, message) => {
    const result = parseBlocks(blockWith(key));

    expect(result.blocks).toHaveLength(0);
    expect(result.errors.join('\n')).toContain(message);
  });
});
