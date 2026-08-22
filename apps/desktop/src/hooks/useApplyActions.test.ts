import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockUpdateState = vi.fn();
let mockState: any = {
  repoRoot: '/repo',
  aiInput: '',
  reviewItems: [],
  v2ReviewFiles: [],
  v2PreviewSession: null,
  historyItems: [],
  selectedItemId: null,
};

vi.mock('./useAppStateContext', () => ({
  useAppStateContext: () => ({
    state: mockState,
    updateState: mockUpdateState,
    setLastAppliedPlan: vi.fn(),
  }),
}));

vi.mock('./useRepositoryActions', () => ({
  initRepositoryState: vi.fn(),
}));

vi.mock('./useHistoryActions', () => ({
  useHistoryActions: () => ({
    restoreItem: vi.fn(),
    restoreGroup: vi.fn(),
  }),
}));

import { useApplyActions } from './useApplyActions';

describe('useApplyActions hook with V2 Apply', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockState = {
      repoRoot: '/repo',
      aiInput: '',
      reviewItems: [],
      v2ReviewFiles: [{ id: 'a.txt' }],
      v2PreviewSession: null,
      historyItems: [],
      selectedItemId: null,
    };
    (global as any).window = {
      inscribeAPI: {
        applyV2: vi.fn(),
        applyChanges: vi.fn(),
      }
    };
  });

  it('Apply Selected on V2 does not call applyV2 and shows Use Apply All', async () => {
    const v2Item = {
      id: '1',
      file: 'a.txt',
      engineVersion: 'v2',
      status: 'pending',
    };
    mockState.reviewItems = [v2Item];
    mockState.selectedItemId = '1';

    const { handleApplySelected } = useApplyActions();
    await handleApplySelected();

    expect(window.inscribeAPI.applyV2).not.toHaveBeenCalled();
    expect(mockUpdateState).toHaveBeenCalledWith({
      statusMessage: 'V2 preview applies as one session. Use Apply All.',
    });
  });

  it('Apply Valid on V2 sessions is blocked', async () => {
    const v2Item = {
      id: '1',
      file: 'a.txt',
      engineVersion: 'v2',
      status: 'pending',
    };
    mockState.reviewItems = [v2Item];

    const { handleApplyValidBlocks } = useApplyActions();
    await handleApplyValidBlocks();

    expect(mockUpdateState).toHaveBeenCalledWith({
      statusMessage: 'Use Apply V2 Preview to apply this reviewed V2 session.',
      pipelineStatus: 'idle',
    });
  });

  it('Apply Valid on mixed V1/V2 sessions is blocked', async () => {
    const v2Item = {
      id: '1',
      file: 'a.txt',
      engineVersion: 'v2',
      status: 'pending',
    };
    const v1Item = {
      id: '2',
      file: 'b.txt',
      status: 'pending',
    };
    mockState.reviewItems = [v2Item, v1Item];

    const { handleApplyValidBlocks } = useApplyActions();
    await handleApplyValidBlocks();

    expect(mockUpdateState).toHaveBeenCalledWith({
      statusMessage: 'Cannot apply mixed V1 and V2 review items in one operation.',
      pipelineStatus: 'idle',
    });
  });

  it('Apply All mixed V1/V2 is blocked', async () => {
    mockState.reviewItems = [
      { id: '1', file: 'a.txt', engineVersion: 'v2', status: 'pending' },
      { id: '2', file: 'b.txt', status: 'pending' },
    ];
    const { handleApplyAll } = useApplyActions();
    await handleApplyAll();
    expect(mockUpdateState).toHaveBeenCalledWith({
      statusMessage: 'Cannot apply mixed V1 and V2 review items in one operation.',
    });
  });

  it('Apply All V2 without token blocks and asks user to parse/preview again', async () => {
    mockState.reviewItems = [
      { id: '1', file: 'a.txt', engineVersion: 'v2', status: 'pending' },
    ];
    mockState.v2PreviewSession = null;
    const { handleApplyAll } = useApplyActions();
    await handleApplyAll();
    expect(mockUpdateState).toHaveBeenCalledWith({
      statusMessage: 'V2 preview session token is missing. Please parse/preview again.',
    });
  });

  it('Apply All V2 successful flow calls applyV2, prepends history, marks applied, and clears token', async () => {
    mockState.reviewItems = [
      { id: '1', file: 'a.txt', engineVersion: 'v2', status: 'pending' },
    ];
    mockState.v2PreviewSession = { previewToken: 'token-v2', expiresAt: '2026' };
    const mockHistory = [{ id: 'hist-1', entryId: 'e1', type: 'v2_apply', appliedAt: '2026' }] as any;
    vi.mocked(window.inscribeAPI.applyV2).mockResolvedValue({
      ok: true,
      appliedFileCount: 1,
      historyEntries: mockHistory,
    });

    const { handleApplyAll } = useApplyActions();
    await handleApplyAll();

    expect(window.inscribeAPI.applyV2).toHaveBeenCalledWith({
      repoRoot: '/repo',
      previewToken: 'token-v2',
    });
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({
      v2PreviewSession: null,
      pipelineStatus: 'apply-success',
      canUndoApply: false,
      lastApplyId: null,
    }));
  });

  it('Apply All V2 failure clears token and does not mark applied', async () => {
    mockState.reviewItems = [
      { id: '1', file: 'a.txt', engineVersion: 'v2', status: 'pending' },
    ];
    mockState.v2PreviewSession = { previewToken: 'token-v2', expiresAt: '2026' };
    vi.mocked(window.inscribeAPI.applyV2).mockResolvedValue({
      ok: false,
      errors: [{ type: 'workspace', code: 'DRIFT', message: 'drifted file' }],
    });

    const { handleApplyAll } = useApplyActions();
    await handleApplyAll();

    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({
      v2PreviewSession: null,
      pipelineStatus: 'apply-failure',
      statusMessage: 'DRIFT: drifted file',
    }));
  });
});
