import type { AppState } from '@/types';
import type { IntakeBlock } from './intake';

export type DiagnosticSeverity = 'error' | 'warning';

export interface DiagnosticGroup {
  id: string;
  title: string;
  severity: DiagnosticSeverity;
  messages: string[];
}

export function buildDiagnosticGroups(
  state: AppState,
  blocks: IntakeBlock[],
): DiagnosticGroup[] {
  const groups: DiagnosticGroup[] = [];
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

  addGroup('parse', 'Parse Errors', 'error', state.parseErrors);

  addGroup(
    'intake',
    'Intake Block Issues',
    blocks.some((block) => block.errors.length > 0) ? 'error' : 'warning',
    blocks.flatMap((block) => [
      ...block.errors.map((message) => `${block.label}: ${message}`),
      ...block.warnings.map((message) => `${block.label}: ${message}`),
    ]),
  );

  addGroup(
    'validation',
    'Validation Errors',
    'error',
    [
      ...state.validationErrors.map((error) => `${error.file}: ${error.message}`),
      ...state.reviewItems
        .filter((item) => item.validationError)
        .map((item) => `${item.file}: ${item.validationError}`),
    ],
  );

  addGroup(
    'repository',
    'Repository / Index Errors',
    'error',
    state.indexStatus.state === 'error' ? [state.indexStatus.message ?? 'Repository indexing failed.'] : [],
  );

  addGroup(
    'apply-restore',
    'Apply / Restore Failures',
    'error',
    [
      state.pipelineStatus === 'apply-failure' ? state.statusMessage : null,
      ...state.historyItems
        .filter((item) => item.restoreStatus && !['idle', 'restoring', 'success'].includes(item.restoreStatus))
        .map((item) => `${item.file}: ${item.restoreMessage ?? item.restoreStatus}`),
    ],
  );

  addGroup('comparison', 'Review Comparison Errors', 'error', [state.reviewComparisonError]);

  return groups;
}
