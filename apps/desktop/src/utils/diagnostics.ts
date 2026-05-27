import type { AppState } from '@/types';
import type { IntakeBlock } from './intake';
import { getReviewItemApplyState } from './review';

export type DiagnosticSeverity = 'error' | 'warning';

export interface DiagnosticGroup {
  id: string;
  title: string;
  severity: DiagnosticSeverity;
  messages: string[];
}

export type DiagnosticMode = AppState['mode'] | 'all';

export function buildDiagnosticGroups(
  state: AppState,
  blocks: IntakeBlock[],
  options: { mode?: DiagnosticMode } = {},
): DiagnosticGroup[] {
  const groups: DiagnosticGroup[] = [];
  const mode = options.mode ?? 'all';
  const addGroup = (
    id: string,
    title: string,
    severity: DiagnosticSeverity,
    messages: Array<string | null | undefined>,
  ) => {
    const uniqueMessages = Array.from(new Set(messages.filter(Boolean) as string[]));
    if (uniqueMessages.length === 0) return;
    groups.push({ id, title, severity, messages: uniqueMessages });
  };

  if (mode === 'intake' || mode === 'all') {
    addGroup('parse-errors', 'Parse Errors', 'error', state.parseErrors);

    addGroup(
      'parse-warnings',
      'Parse Warnings',
      'warning',
      state.parseWarnings?.map(w => w.message) ?? []
    );

    addGroup(
      'intake',
      'Intake Block Issues',
      blocks.some((block) => block.errors.length > 0) ? 'error' : 'warning',
      blocks.flatMap((block) => [
        ...block.errors.map((message) => formatDiagnosticMessage(block.label, message)),
        ...block.warnings.map((message) => formatDiagnosticMessage(block.label, message)),
      ]),
    );
  }

  if (mode === 'review' || mode === 'all') {
    addGroup(
      'validation',
      'Validation Errors',
      'error',
      [
        ...state.validationErrors.map((error) => formatDiagnosticMessage(error.file, error.message)),
        ...state.reviewItems
          .filter((item) => item.validationError)
          .map((item) => formatDiagnosticMessage(item.file, item.validationError)),
      ],
    );
  }

  addGroup(
    'repository',
    'Repository / Index Errors',
    'error',
    state.indexStatus.state === 'error' ? [state.indexStatus.message ?? 'Repository indexing failed.'] : [],
  );

  if (mode === 'review' || mode === 'all') {
    addGroup(
      'apply-restore',
      'Apply / Restore Failures',
      'error',
      [
        state.pipelineStatus === 'apply-failure' ? state.statusMessage : null,
        ...state.historyItems
          .filter((item) => item.restoreStatus && !['idle', 'restoring', 'success'].includes(item.restoreStatus))
          .map((item) => formatDiagnosticMessage(item.file, item.restoreMessage ?? item.restoreStatus)),
      ],
    );

    addGroup(
      'comparison',
      'Review Comparison Errors',
      'error',
      state.reviewItems.flatMap((item) => {
        const itemState = getReviewItemApplyState(item, state.reviewPreflightByItem);
        return itemState.kind === 'blocked-preflight'
          ? [formatDiagnosticMessage(item.file, itemState.blocker)]
          : [];
      }),
    );
  }

  return groups;
}

export function formatDiagnosticMessage(context: string | null | undefined, message: string | null | undefined): string {
  const cleanMessage = message?.trim();
  if (!cleanMessage) {
    return '';
  }
  const cleanContext = context?.trim();
  return cleanContext ? `${cleanContext}: ${cleanMessage}` : cleanMessage;
}

export function formatDiagnosticGroupForClipboard(group: DiagnosticGroup): string {
  return [
    `${group.title} (${group.severity})`,
    ...group.messages.map((message) => `- ${message}`),
  ].join('\n');
}
