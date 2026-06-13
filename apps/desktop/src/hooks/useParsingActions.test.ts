import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockUpdateState = vi.fn();
let mockState: any = {
  repoRoot: '/repo',
  aiInput: '',
};

vi.mock('./useAppStateContext', () => ({
  useAppStateContext: () => ({
    state: mockState,
    updateState: mockUpdateState,
  }),
}));

import { useParsingActions } from './useParsingActions';

describe('useParsingActions V2 & V1 parsing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockState = {
      repoRoot: '/repo',
      aiInput: '',
    };
    (global as any).window = {
      inscribeAPI: {
        previewV2: vi.fn(),
        getAppliedAiInput: vi.fn(),
        confirmPreviouslyAppliedAiInputParse: vi.fn(),
        parseBlocks: vi.fn(),
        validateBlocks: vi.fn(),
      }
    };
  });

  it('successful V2 preview stores token and transitions to review', async () => {
    mockState.aiInput = '<<<INSCRIBE\nFILE: src/a.ts\nINSCRIBE>>>';
    vi.mocked(window.inscribeAPI.previewV2).mockResolvedValue({
      ok: true,
      previewToken: 'tok-123',
      expiresAt: '2026-06-13T23:59:59Z',
      executions: [],
    });

    const { handleParseBlocks } = useParsingActions();
    await handleParseBlocks();

    expect(window.inscribeAPI.previewV2).toHaveBeenCalledWith({
      repoRoot: '/repo',
      rawInput: mockState.aiInput,
    });
    expect(mockUpdateState).toHaveBeenLastCalledWith(expect.objectContaining({
      mode: 'review',
      pipelineStatus: 'parse-success',
      v2PreviewSession: {
        previewToken: 'tok-123',
        expiresAt: '2026-06-13T23:59:59Z',
      },
    }));
  });

  it('failed V2 preview clears token and returns to intake', async () => {
    mockState.aiInput = '<<<INSCRIBE\nFILE: src/a.ts\nINSCRIBE>>>';
    vi.mocked(window.inscribeAPI.previewV2).mockResolvedValue({
      ok: false,
      errors: [{ type: 'protocol', code: 'INVALID', message: 'Wrong protocol' }],
    });

    const { handleParseBlocks } = useParsingActions();
    await handleParseBlocks();

    expect(mockUpdateState).toHaveBeenLastCalledWith(expect.objectContaining({
      mode: 'intake',
      pipelineStatus: 'parse-failure',
      v2PreviewSession: null,
    }));
  });

  it('V1 parse start clears v2PreviewSession', async () => {
    mockState.aiInput = 'V1 input block';
    vi.mocked(window.inscribeAPI.getAppliedAiInput).mockResolvedValue(null);
    vi.mocked(window.inscribeAPI.parseBlocks).mockResolvedValue({ blocks: [], errors: [], warnings: [] });
    vi.mocked(window.inscribeAPI.validateBlocks).mockResolvedValue([]);

    const { handleParseBlocks } = useParsingActions();
    await handleParseBlocks();

    expect(mockUpdateState).toHaveBeenCalledWith({ v2PreviewSession: null });
  });
});
