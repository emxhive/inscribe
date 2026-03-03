import { createHash } from 'crypto';
import { Mode, RestorePayloadV2 } from '@inscribe/shared';

const CONTEXT_WINDOW_CHARS = 240;

export interface RestoreResolution {
  canResolve: boolean;
  resolvedContent?: string;
  confidence?: 'exact' | 'context';
  error?: string;
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function normalizeForMatch(input: string): string {
  return input.replace(/\r\n/g, '\n');
}

export function buildRestorePayload(mode: Mode, file: string, before: string, after: string): RestorePayloadV2 {
  const beforeNorm = normalizeForMatch(before);
  const afterNorm = normalizeForMatch(after);
  const segment = deriveChangedSegment(beforeNorm, afterNorm);

  const preContext = beforeNorm.slice(
    Math.max(0, segment.beforeStart - CONTEXT_WINDOW_CHARS),
    segment.beforeStart
  );
  const postContext = beforeNorm.slice(
    segment.beforeEnd,
    Math.min(beforeNorm.length, segment.beforeEnd + CONTEXT_WINDOW_CHARS)
  );

  return {
    schemaVersion: 2,
    mode,
    file,
    oldContent: segment.beforeChanged,
    newContent: segment.afterChanged,
    baseFileHash: sha256(beforeNorm),
    appliedFileHash: sha256(afterNorm),
    oldContentHash: sha256(segment.beforeChanged),
    newContentHash: sha256(segment.afterChanged),
    oldSpanStart: segment.beforeStart,
    oldSpanEnd: segment.beforeEnd,
    newSpanStart: segment.afterStart,
    newSpanEnd: segment.afterEnd,
    window: {
      preContext,
      postContext,
    },
  };
}

function deriveChangedSegment(before: string, after: string) {
  let prefix = 0;
  const minLength = Math.min(before.length, after.length);
  while (prefix < minLength && before[prefix] === after[prefix]) {
    prefix += 1;
  }

  let beforeSuffix = before.length;
  let afterSuffix = after.length;
  while (
    beforeSuffix > prefix &&
    afterSuffix > prefix &&
    before[beforeSuffix - 1] === after[afterSuffix - 1]
  ) {
    beforeSuffix -= 1;
    afterSuffix -= 1;
  }

  return {
    beforeStart: prefix,
    beforeEnd: beforeSuffix,
    afterStart: prefix,
    afterEnd: afterSuffix,
    beforeChanged: before.slice(prefix, beforeSuffix),
    afterChanged: after.slice(prefix, afterSuffix),
  };
}

export function restoreFromPayload(current: string, payload: RestorePayloadV2): RestoreResolution {
  const content = normalizeForMatch(current);
  if (sha256(content) === payload.appliedFileHash) {
    const exactSlice = content.slice(payload.newSpanStart, payload.newSpanEnd);
    if (exactSlice === payload.newContent) {
      return {
        canResolve: true,
        confidence: 'exact',
        resolvedContent:
          content.slice(0, payload.newSpanStart) + payload.oldContent + content.slice(payload.newSpanEnd),
      };
    }
  }

  const candidates = findAll(content, payload.newContent);
  if (candidates.length === 0) {
    return {
      canResolve: false,
      error: 'Unsafe to restore: applied section not found in file.',
    };
  }

  if (candidates.length === 1) {
    const candidate = candidates[0];
    return {
      canResolve: true,
      confidence: 'context',
      resolvedContent: content.slice(0, candidate.start) + payload.oldContent + content.slice(candidate.end),
    };
  }

  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(content, candidate.start, candidate.end, payload),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const second = scored[1];
  const margin = best.score - (second?.score ?? 0);

  if (best.score < 0.66 || margin < 0.08) {
    return {
      canResolve: false,
      error: 'Unsafe to restore: matched content is ambiguous after file changes.',
    };
  }

  return {
    canResolve: true,
    confidence: 'context',
    resolvedContent:
      content.slice(0, best.candidate.start) + payload.oldContent + content.slice(best.candidate.end),
  };
}

function findAll(content: string, needle: string): Array<{ start: number; end: number }> {
  if (needle.length === 0) {
    return [{ start: 0, end: 0 }];
  }

  const out: Array<{ start: number; end: number }> = [];
  let index = content.indexOf(needle);
  while (index !== -1) {
    out.push({ start: index, end: index + needle.length });
    index = content.indexOf(needle, index + 1);
  }
  return out;
}

function scoreCandidate(content: string, start: number, end: number, payload: RestorePayloadV2): number {
  const preActual = content.slice(Math.max(0, start - payload.window.preContext.length), start);
  const postActual = content.slice(end, Math.min(content.length, end + payload.window.postContext.length));

  const preScore = similarity(payload.window.preContext, preActual);
  const postScore = similarity(payload.window.postContext, postActual);
  const distance = Math.abs(start - payload.newSpanStart);
  const distancePenalty = Math.min(1, distance / 2000);

  return preScore * 0.45 + postScore * 0.45 + (1 - distancePenalty) * 0.1;
}

function similarity(expected: string, actual: string): number {
  if (!expected && !actual) return 1;
  if (!expected || !actual) return 0;
  const maxLen = Math.max(expected.length, actual.length);
  const minLen = Math.min(expected.length, actual.length);
  let same = 0;
  for (let i = 0; i < minLen; i += 1) {
    if (expected[i] === actual[i]) {
      same += 1;
    }
  }
  return same / maxLen;
}
