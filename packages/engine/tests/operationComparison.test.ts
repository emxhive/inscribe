import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  buildOperationComparison,
  buildOperationPreview,
  createOperationComparisonRegion,
  finalizeOperationComparison,
  resolveRangeReplacement,
} from '../src';

describe('Operation comparison', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inscribe-comparison-'));
    fs.mkdirSync(path.join(tempDir, 'app'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('builds an append comparison with deterministic EOF insertion even when content repeats', () => {
    fs.writeFileSync(path.join(tempDir, 'app', 'note.txt'), 'hello\nhello\n');

    const comparison = buildOperationComparison({
      type: 'append',
      file: 'app/note.txt',
      content: 'hello\n',
    }, tempDir);

    expect(comparison.oldContent).toBe('hello\nhello\n');
    expect(comparison.newContent).toBe('hello\nhello\nhello\n');
    expect(comparison.regions).toHaveLength(1);
    expect(comparison.regions[0]).toMatchObject({
      kind: 'insert',
      oldRange: { start: 12, end: 12 },
      newRange: { start: 12, end: 18 },
      oldText: '',
      newText: 'hello\n',
      boundaries: {
        before: { oldOffset: 12, newOffset: 12 },
        after: { oldOffset: 12, newOffset: 18 },
      },
      renderAnchor: {
        oldOffset: 12,
        newOffset: 12,
        side: 'before',
      },
    });
  });

  it('keeps whole-file replace focused on the exact changed segment even for large files', () => {
    const before = `${'a'.repeat(5000)}middle${'z'.repeat(5000)}`;
    const after = `${'a'.repeat(5000)}updated${'z'.repeat(5000)}`;
    fs.writeFileSync(path.join(tempDir, 'app', 'large.txt'), before);

    const comparison = buildOperationComparison({
      type: 'replace',
      file: 'app/large.txt',
      content: after,
    }, tempDir);

    expect(comparison.regions).toHaveLength(1);
    expect(comparison.regions[0]).toMatchObject({
      kind: 'replace',
      oldRange: { start: 5000, end: 5006 },
      newRange: { start: 5000, end: 5007 },
      oldText: 'middle',
      newText: 'updated',
    });
  });

  it('preserves range replacement spans from resolveRangeReplacement as the authoritative region input', () => {
    const filePath = path.join(tempDir, 'app', 'range.txt');
    const oldContent = 'header\nkeep\nold\nend\nfooter\n';
    fs.writeFileSync(filePath, oldContent);

    const operation = {
      type: 'range' as const,
      file: 'app/range.txt',
      content: 'new\n',
      directives: {
        START_AFTER: 'keep',
        END_BEFORE: 'end',
      },
    };

    const resolved = resolveRangeReplacement(oldContent, operation);
    const comparison = buildOperationComparison(operation, tempDir);

    expect(comparison.newContent).toBe(`${resolved.prefix}${resolved.insert}${resolved.suffix}`);
    expect(comparison.regions[0]).toMatchObject({
      kind: 'replace',
      oldRange: { start: resolved.replaceStart, end: resolved.replaceEnd },
      newRange: {
        start: resolved.prefix.length,
        end: resolved.prefix.length + resolved.insert.length,
      },
      oldText: resolved.removed,
      newText: resolved.insert,
    });
  });

  it('tracks repeated similar blocks without collapsing to the wrong duplicate', () => {
    const before = [
      'section A',
      'same',
      'same',
      'section B',
      'same',
      'same',
      '',
    ].join('\n');
    const after = [
      'section A',
      'same',
      'same',
      'section B',
      'same',
      'changed',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(tempDir, 'app', 'duplicates.txt'), before);

    const comparison = buildOperationComparison({
      type: 'replace',
      file: 'app/duplicates.txt',
      content: after,
    }, tempDir);

    const expectedStart = before.lastIndexOf('same\n');
    expect(comparison.regions[0]).toMatchObject({
      kind: 'replace',
      oldRange: { start: expectedStart, end: expectedStart + 4 },
      newRange: { start: expectedStart, end: expectedStart + 7 },
      oldText: 'same',
      newText: 'changed',
    });
  });

  it('records deterministic anchors for zero-width deletion rendering', () => {
    const region = createOperationComparisonRegion({
      id: 'region-0',
      oldContent: 'abcXYZdef',
      newContent: 'abcdef',
      oldRange: { start: 3, end: 6 },
      newRange: { start: 3, end: 3 },
    });

    expect(region).toMatchObject({
      kind: 'delete',
      oldText: 'XYZ',
      newText: '',
      renderAnchor: {
        oldOffset: 3,
        newOffset: 3,
        side: 'before',
      },
    });
  });

  it('represents create as a full-file insertion and delete as an empty-result anchored deletion', () => {
    const createComparison = buildOperationComparison({
      type: 'create',
      file: 'app/new.txt',
      content: 'created\n',
    }, tempDir);

    fs.writeFileSync(path.join(tempDir, 'app', 'remove.txt'), 'gone\n');
    const deleteComparison = buildOperationComparison({
      type: 'delete',
      file: 'app/remove.txt',
      content: '',
    }, tempDir);

    expect(createComparison).toMatchObject({
      type: 'create',
      oldContent: '',
      newContent: 'created\n',
      regions: [{
        kind: 'insert',
        oldRange: { start: 0, end: 0 },
        newRange: { start: 0, end: 8 },
      }],
    });

    expect(deleteComparison).toMatchObject({
      type: 'delete',
      oldContent: 'gone\n',
      newContent: '',
      regions: [{
        kind: 'delete',
        oldRange: { start: 0, end: 5 },
        newRange: { start: 0, end: 0 },
        renderAnchor: {
          oldOffset: 0,
          newOffset: 0,
          side: 'empty',
        },
      }],
    });
  });

  it('derives legacy preview data for create, replace, append, range, and delete', () => {
    fs.writeFileSync(path.join(tempDir, 'app', 'replace.txt'), 'old\n');
    fs.writeFileSync(path.join(tempDir, 'app', 'append.txt'), 'base');
    fs.writeFileSync(path.join(tempDir, 'app', 'range-preview.txt'), 'a\nold\nz\n');
    fs.writeFileSync(path.join(tempDir, 'app', 'delete.txt'), 'trash');

    expect(buildOperationPreview({
      type: 'create',
      file: 'app/create.txt',
      content: 'new file\n',
    }, tempDir)).toMatchObject({
      content: '',
      insert: 'new file\n',
      replaceStart: 0,
      replaceEnd: 0,
      removed: '',
    });

    expect(buildOperationPreview({
      type: 'replace',
      file: 'app/replace.txt',
      content: 'new\n',
    }, tempDir)).toMatchObject({
      content: 'old\n',
      insert: 'new',
      replaceStart: 0,
      replaceEnd: 3,
      removed: 'old',
    });

    expect(buildOperationPreview({
      type: 'append',
      file: 'app/append.txt',
      content: '!',
    }, tempDir)).toMatchObject({
      content: 'base',
      insert: '!',
      replaceStart: 4,
      replaceEnd: 4,
      removed: '',
    });

    expect(buildOperationPreview({
      type: 'range',
      file: 'app/range-preview.txt',
      content: 'new\n',
      directives: {
        START_AFTER: 'a',
        END_BEFORE: 'z',
      },
    }, tempDir)).toMatchObject({
      content: 'a\nold\nz\n',
      insert: 'new\n',
      replaceStart: 2,
      replaceEnd: 6,
      removed: 'old\n',
    });

    expect(buildOperationPreview({
      type: 'delete',
      file: 'app/delete.txt',
      content: '',
    }, tempDir)).toMatchObject({
      content: 'trash',
      insert: '',
      replaceStart: 0,
      replaceEnd: 5,
      removed: 'trash',
    });
  });

  it('supports multiple independently-authored regions through the scaffolding helpers', () => {
    const oldContent = 'abcXYZ123';
    const newContent = 'abc---XYZ+++123';

    const comparison = finalizeOperationComparison({
      operation: {
        type: 'replace',
        file: 'app/multi.txt',
        content: newContent,
      },
      oldContent,
      newContent,
      regions: [
        createOperationComparisonRegion({
          id: 'region-0',
          oldContent,
          newContent,
          oldRange: { start: 3, end: 3 },
          newRange: { start: 3, end: 6 },
        }),
        createOperationComparisonRegion({
          id: 'region-1',
          oldContent,
          newContent,
          oldRange: { start: 6, end: 6 },
          newRange: { start: 9, end: 12 },
        }),
      ],
    });

    expect(comparison.regions.map((region) => region.kind)).toEqual(['insert', 'insert']);
    expect(comparison.regions.map((region) => region.newText)).toEqual(['---', '+++']);
  });

  it('supports replace_symbol in preview/comparison pipeline', () => {
    const filePath = path.join(tempDir, 'app', 'symbol.tsx');
    fs.writeFileSync(
      filePath,
      'export const ParticipantSurfacePanel = () => {\n  return <div>old</div>;\n};\nconst keep = 1;\n'
    );

    const comparison = buildOperationComparison({
      type: 'replace_symbol',
      file: 'app/symbol.tsx',
      directives: { NAME: 'ParticipantSurfacePanel' },
      content: 'export const ParticipantSurfacePanel = () => <section>new</section>;\n',
    }, tempDir);

    expect(comparison.replacementRegions?.length).toBe(1);
    expect(comparison.newContent).toContain('<section>new</section>');
    expect(comparison.newContent).toContain('const keep = 1;');
    expect((comparison.diffHunks ?? []).length).toBeGreaterThan(0);
  });
});
