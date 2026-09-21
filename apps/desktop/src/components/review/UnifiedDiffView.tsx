import {
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { buildUnifiedDiffModel } from '@/utils/reviewComparison';
import { cn } from '@/lib/utils';

export function UnifiedDiffView({
  model,
  selectedHunkId,
  collapsedHunkIds,
  collapsedDiffGroupIds,
  onSelectHunk,
  onToggleHunk,
  onToggleGroup,
}: {
  model: ReturnType<typeof buildUnifiedDiffModel> | null;
  selectedHunkId: string | null;
  collapsedHunkIds: string[];
  collapsedDiffGroupIds: string[];
  onSelectHunk: (hunkId: string) => void;
  onToggleHunk: (hunkId: string) => void;
  onToggleGroup: (groupId: string) => void;
}) {
  if (!model) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading comparison...
      </div>
    );
  }

  if (model.hunks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No diff hunks for this change.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-[#111827] font-mono text-xs text-slate-200">
      <div className="min-w-max py-2">
        {model.hunks.map((hunk) => {
          const isCollapsed =
            collapsedHunkIds.includes(hunk.id);

          const isSelected = selectedHunkId
            ? hunk.sourceHunkIds.includes(selectedHunkId)
            : false;

          return (
            <div key={hunk.id}>
              <button
                type="button"
                onClick={() => {
                  const first = hunk.sourceHunkIds[0];

                  if (first) {
                    onSelectHunk(first);
                  }

                  onToggleHunk(hunk.id);
                }}
                className={cn(
                  'grid w-full grid-cols-[2rem_4rem_4rem_minmax(12rem,1fr)_10rem] items-center bg-slate-800/90 text-left leading-7 text-sky-200 hover:bg-slate-700/90',
                  isSelected &&
                    'outline outline-1 outline-inset outline-sky-500/70',
                )}
              >
                <span className="flex items-center justify-center text-slate-400">
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </span>

                <span className="px-2 text-right text-slate-500">
                  {hunk.oldStartLine}
                </span>

                <span className="px-2 text-right text-slate-500">
                  {hunk.newStartLine}
                </span>

                <span className="truncate px-2">
                  {hunk.header}
                </span>

                <span className="px-2 text-right text-[11px] text-slate-400">
                  {hunk.removedCount} removed, {hunk.addedCount} added
                </span>
              </button>

              {!isCollapsed &&
                hunk.segments.map((segment) =>
                  segment.kind === 'context' ? (
                    <ContextLineGroup
                      key={segment.id}
                      groupId={segment.id}
                      label={segment.label}
                      rows={segment.rows}
                      isCollapsed={collapsedDiffGroupIds.includes(segment.id)}
                      selectedHunkId={selectedHunkId}
                      onSelectHunk={onSelectHunk}
                      onToggleGroup={onToggleGroup}
                    />
                  ) : (
                    <DiffLineGroup
                      key={segment.id}
                      groupId={segment.id}
                      label={
                        segment.kind === 'remove'
                          ? 'removed'
                          : 'added'
                      }
                      count={segment.rows.length}
                      rows={segment.rows}
                      isCollapsed={collapsedDiffGroupIds.includes(segment.id)}
                      selectedHunkId={selectedHunkId}
                      onSelectHunk={onSelectHunk}
                      onToggleGroup={onToggleGroup}
                    />
                  ),
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContextLineGroup({
  groupId,
  label,
  rows,
  isCollapsed,
  selectedHunkId,
  onSelectHunk,
  onToggleGroup,
}: {
  groupId: string;
  label: string;
  rows: ReturnType<typeof buildUnifiedDiffModel>['hunks'][number]['rows'];
  isCollapsed: boolean;
  selectedHunkId: string | null;
  onSelectHunk: (hunkId: string) => void;
  onToggleGroup: (groupId: string) => void;
}) {
  if (rows.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggleGroup(groupId)}
        className="grid w-full grid-cols-[2rem_4rem_4rem_2rem_minmax(0,1fr)] items-center bg-slate-900/80 text-left leading-6 text-slate-300"
      >
        <span className="flex items-center justify-center text-slate-500">
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </span>
        <span />
        <span />
        <span className="text-slate-500"> </span>
        <span className="px-2 text-[11px] text-slate-400">
          {rows.length} {label}
        </span>
      </button>

      {!isCollapsed && (
        <DiffRows
          rows={rows}
          selectedHunkId={selectedHunkId}
          onSelectHunk={onSelectHunk}
        />
      )}
    </div>
  );
}

function DiffLineGroup({
  groupId,
  label,
  count,
  rows,
  isCollapsed,
  selectedHunkId,
  onSelectHunk,
  onToggleGroup,
}: {
  groupId: string;
  label: 'removed' | 'added';
  count: number;
  rows: ReturnType<typeof buildUnifiedDiffModel>['hunks'][number]['rows'];
  isCollapsed: boolean;
  selectedHunkId: string | null;
  onSelectHunk: (hunkId: string) => void;
  onToggleGroup: (groupId: string) => void;
}) {
  if (count === 0) return null;

  const canFold = count > 1;

  return (
    <div>
      {canFold && (
        <button
          type="button"
          onClick={() => onToggleGroup(groupId)}
          className={cn(
            'grid w-full grid-cols-[2rem_4rem_4rem_2rem_minmax(0,1fr)] items-center text-left leading-6',
            label === 'removed'
              ? 'bg-red-950/45 text-red-100'
              : 'bg-emerald-950/45 text-emerald-100',
          )}
        >
          <span className="flex items-center justify-center text-slate-400">
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </span>
          <span />
          <span />
          <span className="text-slate-400">
            {label === 'removed' ? '-' : '+'}
          </span>
          <span className="px-2 text-[11px] text-slate-300">
            {count} {label}
          </span>
        </button>
      )}

      {(!canFold || !isCollapsed) && (
        <DiffRows
          rows={rows}
          selectedHunkId={selectedHunkId}
          onSelectHunk={onSelectHunk}
        />
      )}
    </div>
  );
}

function DiffRows({
  rows,
  selectedHunkId,
  onSelectHunk,
}: {
  rows: ReturnType<typeof buildUnifiedDiffModel>['hunks'][number]['rows'];
  selectedHunkId: string | null;
  onSelectHunk: (hunkId: string) => void;
}) {
  return (
    <>
      {rows.map((row) => (
        <button
          type="button"
          key={row.id}
          onClick={() => onSelectHunk(row.hunkId)}
          className={cn(
            'grid w-full grid-cols-[4rem_4rem_2rem_minmax(0,1fr)] items-start text-left leading-5',
            row.kind === 'context' &&
              'bg-slate-950/55 text-slate-300',
            row.kind === 'remove' &&
              'bg-red-950/35 text-red-100',
            row.kind === 'add' &&
              'bg-emerald-950/35 text-emerald-100',
            selectedHunkId === row.hunkId &&
              'outline outline-1 outline-inset outline-sky-500/50',
          )}
        >
          <span className="px-2 text-right text-slate-500">
            {row.oldLine ?? ''}
          </span>
          <span className="px-2 text-right text-slate-500">
            {row.newLine ?? ''}
          </span>
          <span className="px-2 text-slate-400">
            {row.marker}
          </span>
          <span className="whitespace-pre px-2">
            {row.text || ' '}
          </span>
        </button>
      ))}
    </>
  );
}