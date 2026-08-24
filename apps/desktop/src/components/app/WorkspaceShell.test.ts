import { describe, expect, it } from 'vitest';
import { resolvePrimaryAction } from '@/utils/primaryAction';

const baseState = {
  mode: 'review' as const,
  repoRoot: '/repo',
  isParsingInProgress: false,
  isApplyingInProgress: false,
  v2ReviewFiles: [] as any[],
  reviewItems: [] as any[],
  reviewPreflightByItem: {},
  v2PreviewSession: null,
  v2PreviewDiagnostics: [] as any[],
  pipelineStatus: 'idle' as const,
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
});
