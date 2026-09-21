import { useAppStateContext } from '@/hooks';
import {
  InspectorPropertyGroup,
  InspectorRow,
} from '@/components/inspector/InspectorPrimitives';

export function HistoryReviewInspector() {
  const { state } = useAppStateContext();
  const preview = state.historyReview.preview;

  const selectedReviewFile =
    preview?.files.find(
      (file) => file.entryId === state.historyReview.selectedEntryId,
    ) ?? null;

  const createdAt = preview?.createdAt;
  const actionType = preview?.actionType ?? 'apply';

  return (
    <aside className="flex min-h-0 flex-col border-l border-border bg-card">
      <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-border px-3">
        <p className="text-xs font-semibold text-foreground">
          History Review
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-4">
          <InspectorPropertyGroup title="Action">
            <dl className="divide-y divide-border text-xs">
              <InspectorRow
                label="Type"
                value={
                  actionType === 'restore'
                    ? 'Restore / reversal'
                    : 'Apply'
                }
              />
              <InspectorRow
                label="When"
                value={formatHistoryTimestamp(createdAt)}
              />
              <InspectorRow
                label="Files"
                value={String(preview?.files.length ?? 0)}
              />
              {preview?.sourceActionId && (
                <InspectorRow
                  label="Reverses action"
                  value={preview.sourceActionId}
                  mono
                />
              )}
            </dl>
          </InspectorPropertyGroup>

          {selectedReviewFile && (
            <InspectorPropertyGroup title="Restore safety">
              <dl className="divide-y divide-border text-xs">
                <InspectorRow
                  label="Eligibility"
                  value={
                    selectedReviewFile.eligible
                      ? 'Eligible'
                      : 'Unavailable'
                  }
                />
                <InspectorRow
                  label="Current state"
                  value={
                    selectedReviewFile.currentExists
                      ? 'Present'
                      : 'Absent'
                  }
                />
                <InspectorRow
                  label="Proposed state"
                  value={
                    selectedReviewFile.restoredState
                      ? selectedReviewFile.restoredState.exists
                        ? 'Present'
                        : 'Absent'
                      : 'Unavailable'
                  }
                />
                {selectedReviewFile.sourceEntryId && (
                  <InspectorRow
                    label="Source entry"
                    value={selectedReviewFile.sourceEntryId}
                    mono
                  />
                )}
              </dl>

              {!selectedReviewFile.eligible &&
                selectedReviewFile.error && (
                  <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
                    {selectedReviewFile.error}
                  </p>
                )}
            </InspectorPropertyGroup>
          )}
        </div>
      </div>
    </aside>
  );
}

function formatHistoryTimestamp(timestamp?: string): string {
  if (!timestamp) return 'Unknown time';

  const date = new Date(timestamp);

  return Number.isNaN(date.valueOf())
    ? timestamp
    : date.toLocaleString();
}