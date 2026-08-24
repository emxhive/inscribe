import { describe, expect, it } from 'vitest';
import { resolvePrimaryAction } from '@/utils/primaryAction';
import { isCurrentV2PreviewRequest } from '@/hooks/useHistoryActions';

const baseState = {
  mode: 'review' as const,
  repoRoot: '/repo',
  isParsingInProgress: false,
  isApplyingInProgress: false,
  isRestoringInProgress: false,
  v2ReviewFiles: [] as any[],
  reviewItems: [] as any[],
  reviewPreflightByItem: {},
  v2PreviewSession: null,
  v2PreviewDiagnostics: [] as any[],
  pipelineStatus: 'idle' as const,
  v2HistoryReview: {
    actionId: null,
    requestId: null,
    preview: null,
    isLoading: false,
    isRestoring: false,
    error: null,
  },
  legacyHistoryReview: {
    applyId: null,
  },
};

describe('WorkspaceShell primary action resolution', () => {
  it('resolves Parse Code Blocks as the Intake primary action', () => {
    const action = resolvePrimaryAction({
      ...baseState,
      mode: 'intake',
      repoRoot: '/repo',
    });

    expect(action).toEqual({
      id: 'parse',
      label: 'Parse Code Blocks',
      enabled: true,
    });
  });

  it('resolves Review valid files for a partial V2 preview', () => {
    const action = resolvePrimaryAction({
      ...baseState,
      mode: 'intake',
      pipelineStatus: 'parse-partial',
      v2PreviewSession: { previewToken: 'token', expiresAt: '2026' },
      v2ReviewFiles: [{ id: 'a.txt' } as any],
      v2PreviewDiagnostics: [{ code: 'BLOCK_INVALID', blockIndex: 0 } as any],
    });

    expect(action).toEqual({
      id: 'review-v2-partial',
      label: 'Review 1 Files · 1 Excluded',
      enabled: true,
    });
  });

  it('resolves whole-session Apply V2 Preview only for a valid pending V2 session', () => {
    const action = resolvePrimaryAction({
      ...baseState,
      v2PreviewSession: { previewToken: 'token', expiresAt: '2026' },
      v2ReviewFiles: [{ id: 'a.txt' } as any],
      reviewItems: [{ id: '1', file: 'a.txt', engineVersion: 'v2', status: 'pending' } as any],
    });

    expect(action).toEqual({
      id: 'apply-all',
      label: 'Apply V2 Preview',
      enabled: true,
    });
  });

  it('keeps the V1 Apply All action disabled when no valid apply is available', () => {
    const action = resolvePrimaryAction(baseState);

    expect(action).toEqual({
      id: 'apply-all',
      label: 'Apply All',
      enabled: false,
    });
  });

  it('makes V2 History Review the active primary-action context', () => {
    const action = resolvePrimaryAction({
      ...baseState,
      v2HistoryReview: {
        actionId: 'action-1',
        requestId: 'request-1',
        preview: {
          actionId: 'action-1',
          files: [],
          eligible: true,
        },
        isLoading: false,
        isRestoring: false,
        error: null,
      },
    });

    expect(action).toEqual({
      id: 'history-restore',
      label: 'Restore action',
      enabled: true,
    });
  });

  it('disables the primary action for unavailable History Review and legacy inspection', () => {
    expect(resolvePrimaryAction({
      ...baseState,
      v2HistoryReview: {
        actionId: 'action-1',
        requestId: 'request-1',
        preview: { actionId: 'action-1', files: [], eligible: false },
        isLoading: false,
        isRestoring: false,
        error: 'drift',
      },
    })).toEqual({ id: 'history-restore', label: 'Restore unavailable', enabled: false });

    expect(resolvePrimaryAction({
      ...baseState,
      legacyHistoryReview: { applyId: 'legacy-1' },
    })).toEqual({ id: 'none', label: 'History inspection', enabled: false });
  });

  it('disables every non-history primary action while a restore is executing', () => {
    expect(resolvePrimaryAction({
      ...baseState,
      mode: 'intake',
      isRestoringInProgress: true,
    })).toEqual({ id: 'none', label: 'Restoring...', enabled: false });

    expect(resolvePrimaryAction({
      ...baseState,
      isRestoringInProgress: true,
      v2HistoryReview: {
        actionId: 'action-1',
        requestId: 'request-1',
        preview: { actionId: 'action-1', files: [], eligible: true },
        isLoading: false,
        isRestoring: true,
        error: null,
      },
    })).toEqual({ id: 'history-restore', label: 'Restore action', enabled: false });
  });

  it('accepts only the still-selected V2 preview request', () => {
    const current = {
      repoRoot: '/repo',
      v2HistoryReview: {
        actionId: 'action-2',
        requestId: 'request-2',
        preview: null,
        isLoading: true,
        isRestoring: false,
        error: null,
      },
    };

    expect(isCurrentV2PreviewRequest(current, {
      repoRoot: '/repo',
      actionId: 'action-2',
      requestId: 'request-2',
    })).toBe(true);
    expect(isCurrentV2PreviewRequest(current, {
      repoRoot: '/repo',
      actionId: 'action-1',
      requestId: 'request-1',
    })).toBe(false);
    expect(isCurrentV2PreviewRequest({ ...current, repoRoot: '/other' }, {
      repoRoot: '/repo',
      actionId: 'action-2',
      requestId: 'request-2',
    })).toBe(false);
  });
});
