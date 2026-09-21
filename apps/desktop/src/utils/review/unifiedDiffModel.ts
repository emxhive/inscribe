import type {
  OperationDiffHunk,
} from '@inscribe/shared';
import type { ReviewComparison } from '@/types';

const DEFAULT_DIFF_CONTEXT_LINES = 3;

export type UnifiedDiffRowKind =
  | 'hunk'
  | 'context'
  | 'add'
  | 'remove';

export interface UnifiedDiffRow {
  id: string;
  displayHunkId: string;
  hunkId: string;
  kind: UnifiedDiffRowKind;
  oldLine: number | null;
  newLine: number | null;
  marker: '@@' | ' ' | '+' | '-';
  text: string;
}

export interface UnifiedDiffSegment {
  id: string;
  kind: Exclude<
    UnifiedDiffRowKind,
    'hunk'
  >;
  label: string;
  rows: UnifiedDiffRow[];
}

export interface UnifiedDiffHunkModel {
  id: string;
  index: number;
  kind: OperationDiffHunk['kind'];
  sourceHunkIds: string[];
  header: string;
  oldStartLine: number;
  newStartLine: number;
  beforeContextRows: UnifiedDiffRow[];
  afterContextRows: UnifiedDiffRow[];
  removedCount: number;
  addedCount: number;
  removedRows: UnifiedDiffRow[];
  addedRows: UnifiedDiffRow[];
  segments: UnifiedDiffSegment[];
  rows: UnifiedDiffRow[];
}

export interface UnifiedDiffModel {
  file: string;
  rows: UnifiedDiffRow[];
  hunks: UnifiedDiffHunkModel[];
}

export function buildUnifiedDiffModel(
  comparison: ReviewComparison,
): UnifiedDiffModel {
  const hunks =
    comparison.diffHunks ?? [];

  const rows: UnifiedDiffRow[] = [];
  const hunkModels: UnifiedDiffHunkModel[] =
    [];

  const oldSourceLines =
    splitSourceLines(
      comparison.oldContent,
    );

  const newSourceLines =
    splitSourceLines(
      comparison.newContent,
    );

  const displayHunks =
    coalesceDiffHunksForDisplay({
      hunks,
      oldContent:
        comparison.oldContent,
      newContent:
        comparison.newContent,
      oldSourceLineCount:
        oldSourceLines.length,
      newSourceLineCount:
        newSourceLines.length,
      contextLines:
        DEFAULT_DIFF_CONTEXT_LINES,
    });

  displayHunks.forEach(
    (displayHunk, hunkIndex) => {
      const displayHunkId =
        `display-hunk-${hunkIndex}`;

      const segments =
        buildDisplaySegments({
          displayHunk,
          displayHunkId,
          oldSourceLines,
          newSourceLines,
        });

      const hunkRows =
        segments.flatMap(
          (segment) => segment.rows,
        );

      const removedRows =
        hunkRows.filter(
          (row) =>
            row.kind === 'remove',
        );

      const addedRows =
        hunkRows.filter(
          (row) => row.kind === 'add',
        );

      const beforeContextRows =
        segments[0]?.kind ===
        'context'
          ? segments[0].rows
          : [];

      const afterContextRows =
        segments[
          segments.length - 1
        ]?.kind === 'context'
          ? segments[
              segments.length - 1
            ].rows
          : [];

      const firstRawHunk =
        displayHunk.rawHunks[0];

      const kind =
        displayHunk.rawHunks.length ===
        1
          ? firstRawHunk.hunk.kind
          : 'replace';

      const header =
        buildHunkHeader(
          firstRawHunk.hunk,
          hunkIndex,
          firstRawHunk.oldStartLine,
          firstRawHunk.newStartLine,
          removedRows.length,
          addedRows.length,
        );

      const headerRow: UnifiedDiffRow =
        {
          id: `${displayHunkId}-header`,
          displayHunkId,
          hunkId:
            firstRawHunk.hunk.id,
          kind: 'hunk',
          oldLine: null,
          newLine: null,
          marker: '@@',
          text: header,
        };

      rows.push(headerRow);
      rows.push(...hunkRows);

      hunkModels.push({
        id: displayHunkId,
        index: hunkIndex,
        kind,
        sourceHunkIds:
          displayHunk.rawHunks.map(
            (rawHunk) =>
              rawHunk.hunk.id,
          ),
        header,
        oldStartLine:
          firstRawHunk.oldStartLine,
        newStartLine:
          firstRawHunk.newStartLine,
        beforeContextRows,
        afterContextRows,
        removedCount:
          removedRows.length,
        addedCount:
          addedRows.length,
        removedRows,
        addedRows,
        segments,
        rows: hunkRows,
      });
    },
  );

  return {
    file: comparison.file,
    rows,
    hunks: hunkModels,
  };
}

function buildHunkHeader(
  _hunk: OperationDiffHunk,
  index: number,
  oldStartLine: number,
  newStartLine: number,
  oldCount: number,
  newCount: number,
): string {
  return `Hunk ${index + 1} -${oldStartLine},${oldCount} +${newStartLine},${newCount}`;
}

interface PreparedRawDiffHunk {
  hunk: OperationDiffHunk;
  oldLines: string[];
  newLines: string[];
  oldStartLine: number;
  newStartLine: number;
  oldAfterStartLine: number;
  newAfterStartLine: number;
  oldWindowStart: number;
  newWindowStart: number;
  oldWindowEnd: number;
  newWindowEnd: number;
}

interface DisplayDiffHunk {
  rawHunks: PreparedRawDiffHunk[];
  oldWindowStart: number;
  newWindowStart: number;
  oldWindowEnd: number;
  newWindowEnd: number;
}

function coalesceDiffHunksForDisplay({
  hunks,
  oldContent,
  newContent,
  oldSourceLineCount,
  newSourceLineCount,
  contextLines,
}: {
  hunks: OperationDiffHunk[];
  oldContent: string;
  newContent: string;
  oldSourceLineCount: number;
  newSourceLineCount: number;
  contextLines: number;
}): DisplayDiffHunk[] {
  const prepared = hunks.map(
    (
      hunk,
    ): PreparedRawDiffHunk => {
      const oldLines =
        splitDiffLines(
          hunk.oldText,
        );

      const newLines =
        splitDiffLines(
          hunk.newText,
        );

      const oldStartLine =
        lineAtOffset(
          oldContent,
          hunk.oldRange.start,
        );

      const newStartLine =
        lineAtOffset(
          newContent,
          hunk.newRange.start,
        );

      const oldAfterStartLine =
        oldStartLine +
        oldLines.length;

      const newAfterStartLine =
        newStartLine +
        newLines.length;

      return {
        hunk,
        oldLines,
        newLines,
        oldStartLine,
        newStartLine,
        oldAfterStartLine,
        newAfterStartLine,
        oldWindowStart:
          Math.max(
            1,
            oldStartLine -
              contextLines,
          ),
        newWindowStart:
          Math.max(
            1,
            newStartLine -
              contextLines,
          ),
        oldWindowEnd:
          Math.min(
            oldSourceLineCount,
            oldAfterStartLine +
              contextLines -
              1,
          ),
        newWindowEnd:
          Math.min(
            newSourceLineCount,
            newAfterStartLine +
              contextLines -
              1,
          ),
      };
    },
  );

  const displayHunks: DisplayDiffHunk[] =
    [];

  for (const rawHunk of prepared) {
    const current =
      displayHunks[
        displayHunks.length - 1
      ];

    if (
      !current ||
      !displayWindowsTouch(
        current,
        rawHunk,
      )
    ) {
      displayHunks.push({
        rawHunks: [rawHunk],
        oldWindowStart:
          rawHunk.oldWindowStart,
        newWindowStart:
          rawHunk.newWindowStart,
        oldWindowEnd:
          rawHunk.oldWindowEnd,
        newWindowEnd:
          rawHunk.newWindowEnd,
      });

      continue;
    }

    current.rawHunks.push(rawHunk);

    current.oldWindowStart =
      Math.min(
        current.oldWindowStart,
        rawHunk.oldWindowStart,
      );

    current.newWindowStart =
      Math.min(
        current.newWindowStart,
        rawHunk.newWindowStart,
      );

    current.oldWindowEnd =
      Math.max(
        current.oldWindowEnd,
        rawHunk.oldWindowEnd,
      );

    current.newWindowEnd =
      Math.max(
        current.newWindowEnd,
        rawHunk.newWindowEnd,
      );
  }

  return displayHunks;
}

function displayWindowsTouch(
  current: DisplayDiffHunk,
  next: PreparedRawDiffHunk,
): boolean {
  return (
    rangesTouch(
      current.oldWindowStart,
      current.oldWindowEnd,
      next.oldWindowStart,
      next.oldWindowEnd,
    ) ||
    rangesTouch(
      current.newWindowStart,
      current.newWindowEnd,
      next.newWindowStart,
      next.newWindowEnd,
    )
  );
}

function rangesTouch(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean {
  if (
    endA < startA ||
    endB < startB
  ) {
    return false;
  }

  return startB <= endA + 1;
}

function buildDisplaySegments({
  displayHunk,
  displayHunkId,
  oldSourceLines,
  newSourceLines,
}: {
  displayHunk: DisplayDiffHunk;
  displayHunkId: string;
  oldSourceLines: SourceLine[];
  newSourceLines: SourceLine[];
}): UnifiedDiffSegment[] {
  const segments: UnifiedDiffSegment[] =
    [];

  let segmentIndex = 0;

  let oldCursor =
    displayHunk.oldWindowStart;

  let newCursor =
    displayHunk.newWindowStart;

  const pushSegment = (
    kind: UnifiedDiffSegment['kind'],
    label: string,
    rows: UnifiedDiffRow[],
  ) => {
    if (rows.length === 0) {
      return;
    }

    segments.push({
      id: `${displayHunkId}-segment-${segmentIndex}`,
      kind,
      label,
      rows,
    });

    segmentIndex++;
  };

  const pushContext = (
    oldStartLine: number,
    newStartLine: number,
    count: number,
    label: string,
    hunkId: string,
  ) => {
    pushSegment(
      'context',
      label,
      buildContextRows({
        displayHunkId,
        hunkId,
        idPrefix:
          `context-${segmentIndex}`,
        oldSourceLines,
        newSourceLines,
        oldStartLine,
        newStartLine,
        count,
      }),
    );
  };

  displayHunk.rawHunks.forEach(
    (rawHunk, rawIndex) => {
      const gapCount =
        Math.min(
          Math.max(
            0,
            rawHunk.oldStartLine -
              oldCursor,
          ),
          Math.max(
            0,
            rawHunk.newStartLine -
              newCursor,
          ),
        );

      pushContext(
        oldCursor,
        newCursor,
        gapCount,
        rawIndex === 0
          ? 'context before'
          : 'context',
        rawHunk.hunk.id,
      );

      const removedRows =
        rawHunk.oldLines.map(
          (
            line,
            index,
          ): UnifiedDiffRow => ({
            id: `${displayHunkId}-${rawHunk.hunk.id}-old-${index}`,
            displayHunkId,
            hunkId:
              rawHunk.hunk.id,
            kind: 'remove',
            oldLine:
              rawHunk.oldStartLine +
              index,
            newLine: null,
            marker: '-',
            text: line,
          }),
        );

      pushSegment(
        'remove',
        'removed',
        removedRows,
      );

      const addedRows =
        rawHunk.newLines.map(
          (
            line,
            index,
          ): UnifiedDiffRow => ({
            id: `${displayHunkId}-${rawHunk.hunk.id}-new-${index}`,
            displayHunkId,
            hunkId:
              rawHunk.hunk.id,
            kind: 'add',
            oldLine: null,
            newLine:
              rawHunk.newStartLine +
              index,
            marker: '+',
            text: line,
          }),
        );

      pushSegment(
        'add',
        'added',
        addedRows,
      );

      oldCursor =
        rawHunk.oldAfterStartLine;

      newCursor =
        rawHunk.newAfterStartLine;
    },
  );

  const lastRawHunk =
    displayHunk.rawHunks[
      displayHunk.rawHunks.length - 1
    ];

  const afterContextCount =
    Math.min(
      Math.max(
        0,
        displayHunk.oldWindowEnd -
          oldCursor +
          1,
      ),
      Math.max(
        0,
        displayHunk.newWindowEnd -
          newCursor +
          1,
      ),
    );

  pushContext(
    oldCursor,
    newCursor,
    afterContextCount,
    'context after',
    lastRawHunk.hunk.id,
  );

  return segments;
}

function lineAtOffset(
  content: string,
  offset: number,
): number {
  if (offset <= 0) {
    return 1;
  }

  return content
    .slice(
      0,
      Math.min(
        offset,
        content.length,
      ),
    )
    .split('\n').length;
}

function splitDiffLines(
  text: string,
): string[] {
  if (!text) {
    return [];
  }

  const normalized =
    text.endsWith('\n')
      ? text.slice(0, -1)
      : text;

  if (!normalized) {
    return [''];
  }

  return normalized.split('\n');
}

interface SourceLine {
  lineNumber: number;
  text: string;
}

function splitSourceLines(
  text: string,
): SourceLine[] {
  if (!text) {
    return [];
  }

  const normalized =
    text.endsWith('\n')
      ? text.slice(0, -1)
      : text;

  if (!normalized) {
    return [
      {
        lineNumber: 1,
        text: '',
      },
    ];
  }

  return normalized
    .split('\n')
    .map((line, index) => ({
      lineNumber: index + 1,
      text: line,
    }));
}

function buildContextRows({
  displayHunkId,
  hunkId,
  idPrefix,
  oldSourceLines,
  newSourceLines,
  oldStartLine,
  newStartLine,
  count,
}: {
  displayHunkId: string;
  hunkId: string;
  idPrefix: string;
  oldSourceLines: SourceLine[];
  newSourceLines: SourceLine[];
  oldStartLine: number;
  newStartLine: number;
  count: number;
}): UnifiedDiffRow[] {
  if (count <= 0) {
    return [];
  }

  return Array.from(
    {
      length: count,
    },
    (
      _,
      index,
    ): UnifiedDiffRow => {
      const oldLineNumber =
        oldStartLine + index;

      const newLineNumber =
        newStartLine + index;

      const oldLine =
        oldSourceLines[
          oldLineNumber - 1
        ] ?? null;

      const newLine =
        newSourceLines[
          newLineNumber - 1
        ] ?? null;

      return {
        id: `${hunkId}-${idPrefix}-${index}`,
        displayHunkId,
        hunkId,
        kind: 'context',
        oldLine:
          oldLine?.lineNumber ??
          oldLineNumber,
        newLine:
          newLine?.lineNumber ??
          newLineNumber,
        marker: ' ',
        text:
          newLine?.text ??
          oldLine?.text ??
          '',
      };
    },
  );
}