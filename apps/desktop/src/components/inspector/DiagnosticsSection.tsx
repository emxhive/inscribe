import {
  AlertCircle,
  AlertTriangle,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStateContext } from '@/hooks';
import {
  formatDiagnosticGroupForClipboard,
  type DiagnosticGroup,
} from '@/utils/diagnostics';
import { InspectorEmptyState } from './InspectorPrimitives';

export function DiagnosticsSection({
  groups,
  onNavigate,
}: {
  groups: DiagnosticGroup[];
  onNavigate: (target: { blockId: string; line?: number }) => void;
}) {
  const { state, updateState } = useAppStateContext();

  const handleCopy = async (group: DiagnosticGroup) => {
    const summary = formatDiagnosticGroupForClipboard(group);
    const previewDetails = state.previewDiagnostics.length > 0
      ? `\n\nPreview Diagnostic Details\n${JSON.stringify(state.previewDiagnostics, null, 2)}`
      : '';
    const text = `${summary}${previewDetails}`;

    try {
      await navigator.clipboard.writeText(text);
      updateState({
        statusMessage: `Copied ${group.title.toLowerCase()}.`,
      });
    } catch {
      updateState({
        statusMessage: 'Unable to copy diagnostics.',
      });
    }
  };

  if (groups.length === 0) {
    return <InspectorEmptyState message="No diagnostics." />;
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.id}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="h-7 w-7"
              onClick={() => handleCopy(group)}
              aria-label={`Copy ${group.title}`}
              title={`Copy ${group.title}`}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>

          <ul className="divide-y divide-border border-y border-border text-xs">
            {group.messages.map((message, index) => {
              const target = group.targetsByMessage?.[message];

              return (
                <li
                  key={`${group.id}-${index}`}
                  className="flex items-start gap-2 py-2"
                >
                  {group.severity === 'error' ? (
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-destructive" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
                  )}

                  {target ? (
                    <button
                      type="button"
                      className="min-w-0 flex-1 break-words text-left leading-relaxed text-foreground transition-colors hover:text-primary"
                      onClick={() => onNavigate(target)}
                      title={
                        target.line
                          ? `Go to line ${target.line}`
                          : 'Go to block'
                      }
                    >
                      {message}
                    </button>
                  ) : (
                    <p className="min-w-0 flex-1 break-words leading-relaxed text-foreground">
                      {message}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}