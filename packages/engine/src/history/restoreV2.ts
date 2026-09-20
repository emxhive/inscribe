import { createHash } from 'crypto';
import { Mode, RestorePayloadV2 } from '@inscribe/shared';

const CONTEXT_WINDOW_CHARS = 240;
type LineEnding = '\n' | '\r\n' | '\r';

export interface ChangedSegment {
  beforeStart: number;
  beforeEnd: number;
  afterStart: number;
  afterEnd: number;
  beforeChanged: string;
  afterChanged: string;
}
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function normalizeForMatch(input: string): string {
  return input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
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
    lineEnding: detectDominantLineEnding(before) ?? detectDominantLineEnding(after),
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

export function deriveChangedSegment(before: string, after: string): ChangedSegment {
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

export function restorePayloadLineEndings(input: string, payload: RestorePayloadV2): string {
  return restoreLineEndings(input, payload.lineEnding);
}

function detectDominantLineEnding(input: string): LineEnding | undefined {
  let lf = 0;
  let crlf = 0;
  let cr = 0;

  for (let index = 0; index < input.length; index += 1) {
    if (input[index] === '\r') {
      if (input[index + 1] === '\n') {
        crlf += 1;
        index += 1;
      } else {
        cr += 1;
      }
    } else if (input[index] === '\n') {
      lf += 1;
    }
  }

  if (crlf >= lf && crlf >= cr && crlf > 0) return '\r\n';
  if (lf >= cr && lf > 0) return '\n';
  if (cr > 0) return '\r';
  return undefined;
}

function restoreLineEndings(input: string, lineEnding: LineEnding | undefined): string {
  if (!lineEnding || lineEnding === '\n') {
    return input;
  }

  return input.replace(/\n/g, lineEnding);
}
