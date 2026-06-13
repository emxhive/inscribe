import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockRequireTrustedRepoRoot = vi.hoisted(() => vi.fn());
const mockApplyV2OnWorker = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock('./trustedRepo', () => ({
  requireTrustedRepoRoot: mockRequireTrustedRepoRoot,
}));

vi.mock('./engineWorkerClient', () => ({
  applyV2OnWorker: mockApplyV2OnWorker,
}));

import { ipcMain } from 'electron';
import { registerApplyV2Handlers } from './applyV2';

const mockEvent = { sender: {} } as any;

describe('apply-v2 IPC Route Validation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('registers the apply-v2 IPC handler', () => {
    registerApplyV2Handlers();
    expect(ipcMain.handle).toHaveBeenCalledWith('apply-v2', expect.any(Function));
  });

  it('rejects invalid args object with INVALID_IPC_INPUT', async () => {
    registerApplyV2Handlers();
    const handler = vi.mocked(ipcMain.handle).mock.calls[0][1] as any;

    const res1 = await handler(mockEvent, null);
    expect(res1.ok).toBe(false);
    expect(res1.errors[0].code).toBe('INVALID_IPC_INPUT');

    const res2 = await handler(mockEvent, 'not-an-object');
    expect(res2.ok).toBe(false);
    expect(res2.errors[0].code).toBe('INVALID_IPC_INPUT');
  });

  it('rejects missing repoRoot or blank previewToken with INVALID_IPC_INPUT', async () => {
    registerApplyV2Handlers();
    const handler = vi.mocked(ipcMain.handle).mock.calls[0][1] as any;

    // missing previewToken
    const res1 = await handler(mockEvent, { repoRoot: '/repo' });
    expect(res1.ok).toBe(false);
    expect(res1.errors[0].code).toBe('INVALID_IPC_INPUT');

    // blank previewToken
    const res2 = await handler(mockEvent, { repoRoot: '/repo', previewToken: '' });
    expect(res2.ok).toBe(false);
    expect(res2.errors[0].code).toBe('INVALID_IPC_INPUT');

    // missing repoRoot
    const res3 = await handler(mockEvent, { previewToken: 'token' });
    expect(res3.ok).toBe(false);
    expect(res3.errors[0].code).toBe('INVALID_IPC_INPUT');
  });

  it('rejects blank or whitespace-only repoRoot or previewToken with INVALID_IPC_INPUT', async () => {
    registerApplyV2Handlers();
    const handler = vi.mocked(ipcMain.handle).mock.calls[0][1] as any;

    const res1 = await handler(mockEvent, { repoRoot: '', previewToken: 'token' });
    expect(res1.ok).toBe(false);
    expect(res1.errors[0].code).toBe('INVALID_IPC_INPUT');

    const res2 = await handler(mockEvent, { repoRoot: '   ', previewToken: 'token' });
    expect(res2.ok).toBe(false);
    expect(res2.errors[0].code).toBe('INVALID_IPC_INPUT');

    const res3 = await handler(mockEvent, { repoRoot: '/repo', previewToken: '' });
    expect(res3.ok).toBe(false);
    expect(res3.errors[0].code).toBe('INVALID_IPC_INPUT');

    const res4 = await handler(mockEvent, { repoRoot: '/repo', previewToken: '   ' });
    expect(res4.ok).toBe(false);
    expect(res4.errors[0].code).toBe('INVALID_IPC_INPUT');
  });

  it('uses requireTrustedRepoRoot, forwards only trustedRepoRoot + previewToken, and ignores extra renderer fields', async () => {
    registerApplyV2Handlers();
    const handler = vi.mocked(ipcMain.handle).mock.calls[0][1] as any;

    mockRequireTrustedRepoRoot.mockReturnValue('/trusted-root-path');
    mockApplyV2OnWorker.mockResolvedValue({ ok: true, appliedFileCount: 1, historyEntries: [] });

    const args = {
      repoRoot: '/renderer-supplied-path',
      previewToken: 'some-token',
      extraField: 'should-be-ignored',
    };

    const response = await handler(mockEvent, args);
    expect(response.ok).toBe(true);

    expect(mockRequireTrustedRepoRoot).toHaveBeenCalledWith(mockEvent, '/renderer-supplied-path');
    expect(mockApplyV2OnWorker).toHaveBeenCalledWith({
      trustedRepoRoot: '/trusted-root-path',
      previewToken: 'some-token',
    });
  });

  it('sanitizes unexpected main-process failures and hides raw messages', async () => {
    registerApplyV2Handlers();
    const handler = vi.mocked(ipcMain.handle).mock.calls[0][1] as any;

    mockRequireTrustedRepoRoot.mockImplementation(() => {
      throw new Error('Fatal error revealing internal DB connection details');
    });

    const response = await handler(mockEvent, { repoRoot: '/repo', previewToken: 'token' });
    expect(response.ok).toBe(false);
    expect(response.errors[0].code).toBe('UNEXPECTED_SYSTEM_ERROR');
    expect(response.errors[0].message).toBe('V2 apply request failed.');
    expect(response.errors[0].message).not.toContain('revealing internal DB');
  });
});
