import {
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useAppStateContext } from '@/hooks';
import { cn } from '@/lib/utils';

export function HistoryFileList() {
  const { state, updateState } =
    useAppStateContext();

  const historyFiles =
    state.historyReview.preview?.files ??
    [];

  return (
    <>
      <div className="flex h-10 items-center justify-between border-b border-border px-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          History Review
        </span>

        <span className="text-xs font-semibold text-foreground">
          {historyFiles.length}
        </span>
      </div>

      {historyFiles.length === 0 ? (
        <div className="p-3 text-xs text-muted-foreground">
          {state.historyReview.isLoading
            ? 'Checking historical files...'
            : 'No historical files available.'}
        </div>
      ) : (
        <ul className="m-0 flex min-h-0 flex-1 list-none flex-col overflow-y-auto overflow-x-hidden p-0">
          {historyFiles.map((file) => {
            const fileName =
              file.file
                .split(/[\\/]/)
                .filter(Boolean)
                .pop() ?? file.file;

            const isSelected =
              state.historyReview
                .selectedEntryId ===
              file.entryId;

            const StatusIcon =
              file.eligible
                ? CheckCircle2
                : XCircle;

            return (
              <li
                key={file.entryId}
                className="border-b border-border"
              >
                <button
                  type="button"
                  onClick={() =>
                    updateState({
                      historyReview: {
                        ...state.historyReview,
                        selectedEntryId:
                          file.entryId,
                      },
                    })
                  }
                  className={cn(
                    'w-full px-3 py-2 text-left blue-tint-interactive',
                    isSelected && 'blue-tint',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <StatusIcon
                      className={cn(
                        'h-3.5 w-3.5 flex-shrink-0',
                        file.eligible
                          ? 'text-emerald-600'
                          : 'text-destructive',
                      )}
                    />

                    <span
                      className="min-w-0 flex-1 truncate text-xs font-medium text-foreground"
                      title={file.file}
                    >
                      {fileName}
                    </span>
                  </div>

                  <div className="mt-1 pl-5 text-[10px] text-muted-foreground">
                    {file.eligible
                      ? 'Eligible to restore'
                      : 'Unavailable'}

                    {file.currentExists !==
                      (file.restoredState
                        ?.exists ??
                        file.currentExists) &&
                      ' · state changes'}
                  </div>

                  {!file.eligible &&
                    file.error && (
                      <p
                        className="mt-0.5 truncate pl-5 text-[10px] text-destructive"
                        title={file.error}
                      >
                        {file.error}
                      </p>
                    )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
