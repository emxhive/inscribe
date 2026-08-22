import { describe, expect, it } from 'vitest';

function computeButtonStates(state: {
  repoRoot: string | null;
  v2PreviewSession: any;
  v2ReviewFiles: any[];
  reviewItems: any[];
  applySummary: { canApplyAll: boolean };
}) {
  const hasOnlyPendingV2Items =
    state.v2ReviewFiles.length > 0 &&
    state.reviewItems.length > 0 &&
    state.reviewItems.every((item) => item.engineVersion === 'v2' && item.status === 'pending');

  const canApplyV2Session =
    Boolean(state.repoRoot) &&
    Boolean(state.v2PreviewSession) &&
    hasOnlyPendingV2Items;

  const enableApplyAll = state.applySummary.canApplyAll || canApplyV2Session;
  const applyAllButtonLabel = canApplyV2Session ? 'Apply V2 Preview' : 'Apply All';

  return { enableApplyAll, applyAllButtonLabel, canApplyV2Session };
}

describe('WorkspaceShell bottom bar button state logic', () => {
  it('enables Apply V2 Preview when session is pure pending V2 and token is stored', () => {
    const state = {
    repoRoot: '/repo',
    v2PreviewSession: { previewToken: 'token', expiresAt: '2026' },
      v2ReviewFiles: [{ id: 'a.txt' }],
      reviewItems: [
        { id: '1', file: 'a.txt', engineVersion: 'v2', status: 'pending' },
      ],
      applySummary: { canApplyAll: false },
    };

    const res = computeButtonStates(state);
    expect(res.canApplyV2Session).toBe(true);
    expect(res.enableApplyAll).toBe(true);
    expect(res.applyAllButtonLabel).toBe('Apply V2 Preview');
  });

  it('disables Apply All when pure V2 review is missing token', () => {
    const state = {
    repoRoot: '/repo',
    v2PreviewSession: null,
      v2ReviewFiles: [{ id: 'a.txt' }],
      reviewItems: [
        { id: '1', file: 'a.txt', engineVersion: 'v2', status: 'pending' },
      ],
      applySummary: { canApplyAll: false },
    };

    const res = computeButtonStates(state);
    expect(res.canApplyV2Session).toBe(false);
    expect(res.enableApplyAll).toBe(false);
    expect(res.applyAllButtonLabel).toBe('Apply All');
  });

  it('disables V2 apply and button when mixed V1/V2 review items exist', () => {
    const state = {
    repoRoot: '/repo',
    v2PreviewSession: { previewToken: 'token', expiresAt: '2026' },
      v2ReviewFiles: [{ id: 'a.txt' }],
      reviewItems: [
        { id: '1', file: 'a.txt', engineVersion: 'v2', status: 'pending' },
        { id: '2', file: 'b.txt', status: 'pending' }, // V1 item
      ],
      applySummary: { canApplyAll: false },
    };

    const res = computeButtonStates(state);
    expect(res.canApplyV2Session).toBe(false);
    expect(res.enableApplyAll).toBe(false);
    expect(res.applyAllButtonLabel).toBe('Apply All');
  });

  it('stricter: disables Apply All if V2 items are already applied', () => {
    const state = {
    repoRoot: '/repo',
    v2PreviewSession: { previewToken: 'token', expiresAt: '2026' },
      v2ReviewFiles: [{ id: 'a.txt' }],
      reviewItems: [
        { id: '1', file: 'a.txt', engineVersion: 'v2', status: 'applied' },
      ],
      applySummary: { canApplyAll: false },
    };

    const res = computeButtonStates(state);
    expect(res.canApplyV2Session).toBe(false);
    expect(res.enableApplyAll).toBe(false);
    expect(res.applyAllButtonLabel).toBe('Apply All');
  });
});
