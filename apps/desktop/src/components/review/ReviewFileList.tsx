import {
  CheckCircle2,
  CircleDot,
} from 'lucide-react';
import {
  useAppStateContext,
  useReviewActions,
} from '@/hooks';
import { cn } from '@/lib/utils';

function countChangedLines(
  text: string,
): number {
  if (!text) return 0;

  const withoutTrailingNewline =
    text.endsWith('\n')
      ? text.slice(0, -1)
      : text;

  return withoutTrailingNewline.length === 0
    ? 1
    : withoutTrailingNewline.split('\n')
        .length;
}

export function ReviewFileList() {
  const { state } =
    useAppStateContext();

  const { handleSelectReviewFile } =
    useReviewActions();

  return (
    <>
      <div className="flex h-10 items-center justify-between border-b border-border px-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Changes
        </span>

        <span className="text-xs font-semibold text-foreground">
          {state.reviewFiles.length}
        </span>
      </div>

      <ul className="m-0 flex min-h-0 flex-1 list-none flex-col overflow-y-auto overflow-x-hidden p-0">
        {state.reviewFiles.map((file) => {
          const fileName =
            file.filePath.split('/').pop() ??
            file.filePath;

          const parentPath =
            file.filePath.slice(
              0,
              -(
                fileName.length + 1
              ),
            );

          const operations =
            state.reviewItems.filter(
              (item) =>
                file.operationIds.includes(
                  item.id,
                ),
            );

          const sidebarStatus =
            operations.length > 0 &&
            operations.every(
              (item) =>
                item.status === 'applied',
            )
              ? 'applied'
              : 'pending';

          const StatusIcon =
            sidebarStatus === 'applied'
              ? CheckCircle2
              : CircleDot;

          return (
            <li
              key={file.id}
              className="border-b border-border"
            >
              <button
                type="button"
                onClick={() =>
                  handleSelectReviewFile(
                    file.id,
                  )
                }
                className={cn(
                  'w-full px-3 py-2 text-left transition-colors',
                  state.selectedReviewFileId ===
                    file.id
                    ? 'bg-primary/10'
                    : 'hover:bg-secondary/70',
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <StatusIcon
                    className={cn(
                      'h-3.5 w-3.5 flex-shrink-0',
                      sidebarStatus ===
                        'applied'
                        ? 'text-emerald-600'
                        : 'text-muted-foreground',
                    )}
                  />

                  <span
                    className="min-w-0 flex-1 truncate text-xs font-medium text-foreground"
                    title={file.filePath}
                  >
                    {fileName}
                  </span>

                  <div className="flex flex-shrink-0 items-center gap-1.5 font-mono text-[10px] font-semibold">
                    <span className="text-emerald-700 dark:text-emerald-400">
                      +
                      {file.comparison.diffHunks?.reduce(
                        (sum, hunk) =>
                          sum +
                          countChangedLines(
                            hunk.newText,
                          ),
                        0,
                      ) ?? 0}
                    </span>

                    <span className="text-destructive">
                      −
                      {file.comparison.diffHunks?.reduce(
                        (sum, hunk) =>
                          sum +
                          countChangedLines(
                            hunk.oldText,
                          ),
                        0,
                      ) ?? 0}
                    </span>
                  </div>
                </div>

                <div className="mt-0.5 flex min-w-0 items-center gap-1.5 pl-5 text-[10px] text-muted-foreground">
                  {parentPath && (
                    <span
                      className="min-w-0 flex-1 truncate font-mono"
                      title={parentPath}
                    >
                      {parentPath}
                    </span>
                  )}

                  {parentPath && (
                    <span aria-hidden>
                      ·
                    </span>
                  )}

                  <span className="flex-shrink-0">
                    {operations.length}{' '}
                    operation
                    {operations.length ===
                    1
                      ? ''
                      : 's'}
                  </span>

                  {operations.some(
                    (item) =>
                      item.targetScope
                        .matchMetadata
                        ?.kind ===
                      'fallback',
                  ) && (
                    <span className="flex-shrink-0 text-amber-600 dark:text-amber-400">
                      · fallback
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}