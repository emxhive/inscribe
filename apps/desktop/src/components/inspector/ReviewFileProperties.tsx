import { AlertTriangle } from 'lucide-react';
import type {
  ReviewFile,
  ReviewItem,
} from '@/types';
import { toSentenceCase } from '@/utils';
import {
  InspectorPropertyGroup,
  InspectorRow,
} from './InspectorPrimitives';

export function ReviewFileProperties({
  file,
  operations,
}: {
  file: ReviewFile;
  operations: ReviewItem[];
}) {
  const diffHunks =
    file.comparison.diffHunks ?? [];

  const countChangedLines = (
    text: string,
  ) => {
    if (!text) return 0;

    const withoutTrailingNewline =
      text.endsWith('\n')
        ? text.slice(0, -1)
        : text;

    return withoutTrailingNewline.length ===
      0
      ? 1
      : withoutTrailingNewline.split('\n')
          .length;
  };

  const stateLabel =
    !file.beforeExists &&
    file.afterExists
      ? 'Created'
      : file.beforeExists &&
          !file.afterExists
        ? 'Deleted'
        : 'Modified';

  const statusLabel =
    operations.length > 0 &&
    operations.every(
      (operation) =>
        operation.status === 'applied',
    )
      ? 'Applied'
      : 'Ready to apply';

  return (
    <div className="space-y-5">
      <InspectorPropertyGroup title="Final change">
        <dl className="divide-y divide-border text-xs">
          <InspectorRow
            label="File"
            value={file.filePath}
            mono
          />

          <InspectorRow
            label="State"
            value={stateLabel}
          />

          <InspectorRow
            label="Status"
            value={statusLabel}
          />

          <div className="grid min-h-8 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 py-1.5">
            <dt className="text-muted-foreground">
              Change
            </dt>

            <dd className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                +
                {diffHunks.reduce(
                  (sum, hunk) =>
                    sum +
                    countChangedLines(
                      hunk.newText,
                    ),
                  0,
                )}
              </span>

              <span className="font-mono font-semibold text-destructive">
                −
                {diffHunks.reduce(
                  (sum, hunk) =>
                    sum +
                    countChangedLines(
                      hunk.oldText,
                    ),
                  0,
                )}
              </span>

              <span className="text-muted-foreground">
                {diffHunks.length} hunk
                {diffHunks.length === 1
                  ? ''
                  : 's'}
              </span>
            </dd>
          </div>

          <InspectorRow
            label="Operations"
            value={String(
              operations.length,
            )}
          />
        </dl>
      </InspectorPropertyGroup>

      <InspectorPropertyGroup title="Provenance">
        <div className="divide-y divide-border text-xs">
          {operations.map(
            (operation) => {
              const target =
                operation.targetScope
                  .selectorText ??
                (operation.targetScope
                  .lineRange
                  ? `Lines ${operation.targetScope.lineRange.startLine}–${operation.targetScope.lineRange.endLine}`
                  : operation.strategy ===
                        'replace_file' ||
                      operation.strategy ===
                        'create_file' ||
                      operation.strategy ===
                        'delete_file'
                    ? 'Whole file'
                    : 'Target resolved');

              const fallback =
                operation.targetScope
                  .matchMetadata
                  ?.kind === 'fallback';

              return (
                <div
                  key={operation.id}
                  className="grid min-h-7 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 py-1"
                >
                  <span className="whitespace-nowrap text-[10px] font-medium text-muted-foreground">
                    {operation.operationIndex +
                      1}{' '}
                    · B
                    {operation.blockIndex +
                      1}
                  </span>

                  <span className="whitespace-nowrap font-mono text-[10px] text-foreground">
                    {operation.strategy}
                  </span>

                  <span
                    className="min-w-0 truncate font-mono text-[10px] text-muted-foreground"
                    title={target}
                  >
                    {target}
                  </span>

                  {fallback && (
                    <span
                      className="flex flex-shrink-0 items-center"
                      title="Fallback targeting used"
                      aria-label="Fallback targeting used"
                    >
                      <AlertTriangle
                        className="h-3 w-3 text-amber-600 dark:text-amber-400"
                        aria-hidden="true"
                      />
                    </span>
                  )}
                </div>
              );
            },
          )}
        </div>
      </InspectorPropertyGroup>

      {operations.some(
        (operation) =>
          operation.targetScope
            .matchMetadata?.kind ===
          'fallback',
      ) && (
        <InspectorPropertyGroup title="Match / targeting">
          <dl className="divide-y divide-border text-xs">
            {operations
              .filter(
                (operation) =>
                  operation.targetScope
                    .matchMetadata?.kind ===
                  'fallback',
              )
              .map((operation) => {
                const metadata =
                  operation.targetScope
                    .matchMetadata!;

                return (
                  <div
                    key={operation.id}
                    className="py-1.5"
                  >
                    <div className="mb-1 text-muted-foreground">
                      Operation{' '}
                      {operation.operationIndex +
                        1}
                    </div>

                    {typeof metadata.score ===
                      'number' && (
                      <InspectorRow
                        label="Score"
                        value={`${Math.round(
                          metadata.score *
                            100,
                        )}%`}
                      />
                    )}

                    {metadata.fallbackReason && (
                      <InspectorRow
                        label="Reason"
                        value={toSentenceCase(
                          metadata.fallbackReason,
                        )}
                      />
                    )}

                    {metadata.unmatchedSoftTokens &&
                      metadata
                        .unmatchedSoftTokens
                        .length > 0 && (
                        <InspectorRow
                          label="Unmatched"
                          value={metadata.unmatchedSoftTokens.join(
                            ', ',
                          )}
                          mono
                        />
                      )}
                  </div>
                );
              })}
          </dl>
        </InspectorPropertyGroup>
      )}
    </div>
  );
}