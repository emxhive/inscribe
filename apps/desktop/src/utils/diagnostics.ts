import type { AppState } from '@/types';
import type { IntakeBlock } from './intake';
import { findDiagnosticBlock } from './intakeDiagnostics';

export type DiagnosticSeverity = 'error' | 'warning';

export interface DiagnosticGroup {
  id: string;
  title: string;
  severity: DiagnosticSeverity;
  messages: string[];
  targetsByMessage?: Record<string, { blockId: string; line?: number }>;
}

export type DiagnosticMode = AppState['mode'] | 'all';

export function buildDiagnosticGroups(
  state: AppState,
  blocks: IntakeBlock[],
  options: { mode?: DiagnosticMode; globalWarnings?: string[] } = {},
): DiagnosticGroup[] {
  const groups: DiagnosticGroup[] = [];
  const mode = options.mode ?? 'all';
  const addGroup = (
    id: string,
    title: string,
    severity: DiagnosticSeverity,
    messages: Array<string | null | undefined>,
    targetsByMessage?: Record<string, { blockId: string; line?: number }>,
  ) => {
    const uniqueMessages = Array.from(new Set(messages.filter(Boolean) as string[]));
    if (uniqueMessages.length === 0) return;
    groups.push({ id, title, severity, messages: uniqueMessages, targetsByMessage });
  };

  if (mode === 'intake' || mode === 'all') {
    addGroup('parse-errors', 'Parse Errors', 'error', state.parseErrors);

    addGroup(
      'parse-warnings',
      'Parse Warnings',
      'warning',
      [
        ...(state.parseWarnings?.map(w => w.message) ?? []),
        ...(options.globalWarnings ?? []),
      ]
    );

    addGroup(
      'intake',
      'Intake Block Issues',
      blocks.some((block) => block.errors.length > 0) ? 'error' : 'warning',
      blocks.flatMap((block) => [
        ...block.errors.map((message) => formatDiagnosticMessage(block.label, message)),
        ...block.warnings.map((message) => formatDiagnosticMessage(block.label, message)),
      ]),
      Object.fromEntries(blocks.flatMap((block) => [
        ...block.errors.map((message) => [
          formatDiagnosticMessage(block.label, message),
          { blockId: block.id },
        ] as const),
        ...block.warnings.map((message) => [
          formatDiagnosticMessage(block.label, message),
          { blockId: block.id },
        ] as const),
      ])),
    );

    const globalDiagnostics = state.previewDiagnostics.filter(
      (diagnostic) => !findDiagnosticBlock(blocks, diagnostic),
    );
    addGroup(
      'preview-global',
      'Preview Errors',
      'error',
      globalDiagnostics.map((diagnostic) => `[${diagnostic.code}] ${diagnostic.message}`),
    );
  }

    if (mode === 'review' || mode === 'all') {
    addGroup('preview', 'Preview Errors', 'error', state.previewDiagnostics.map((diagnostic) => (
      `[${diagnostic.code}] ${diagnostic.message}`
    )));
  }

  addGroup(
    'repository',
    'Repository / Index Errors',
    'error',
    state.indexStatus.state === 'error' ? [state.indexStatus.message ?? 'Repository indexing failed.'] : [],
  );

  if (mode === 'review' || mode === 'all') {
    addGroup('apply-restore', 'Apply / Restore Failures', 'error', [
      state.pipelineStatus === 'apply-failure' ? state.statusMessage : null,
    ]);
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
