import { describe, expect, it } from 'vitest';

import {
  buildRestorePayload,
  deriveChangedSegment,
  restoreFromPayload,
} from '../src/apply/restoreV2';

describe('restoreV2 audit coverage', () => {
  it('shares exact prefix/suffix trimming semantics with review comparison primitives', () => {
    expect(deriveChangedSegment('prefix old suffix', 'prefix new suffix')).toEqual({
      beforeStart: 7,
      beforeEnd: 10,
      afterStart: 7,
      afterEnd: 10,
      beforeChanged: 'old',
      afterChanged: 'new',
    });
  });

  it('normalizes CRLF when building restore payloads', () => {
    const payload = buildRestorePayload('replace', 'app/file.txt', 'one\r\ntwo\r\n', 'one\r\nthree\r\n');

    expect(payload.oldContent).toBe('wo');
    expect(payload.newContent).toBe('hree');
    expect(payload.oldSpanStart).toBe(5);
    expect(payload.newSpanStart).toBe(5);
  });

  it('rejects ambiguous restore matches when duplicate applied content lacks enough context', () => {
    const payload = buildRestorePayload(
      'replace',
      'app/file.txt',
      'start\nold\nend\n',
      'start\nnew\nend\n',
    );

    const ambiguousCurrent = 'noise\nnew\nnoise\nnew\nnoise\n';
    const resolution = restoreFromPayload(ambiguousCurrent, payload);

    expect(resolution.canResolve).toBe(false);
    expect(resolution.error).toContain('ambiguous');
  });

  it('keeps restore exact when the applied content hash still matches', () => {
    const before = 'alpha\nold\nomega\n';
    const after = 'alpha\nnew\nomega\n';
    const payload = buildRestorePayload('replace', 'app/file.txt', before, after);

    const resolution = restoreFromPayload(after, payload);

    expect(resolution).toMatchObject({
      canResolve: true,
      confidence: 'exact',
      resolvedContent: before,
    });
  });
});
