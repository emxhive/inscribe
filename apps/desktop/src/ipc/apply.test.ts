import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockRequireTrustedRepoRoot = vi.hoisted(() => vi.fn());
const mockApplyOnWorker = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock('./trustedRepo', () => ({
  requireTrustedRepoRoot: mockRequireTrustedRepoRoot,
}));

vi.mock('./engineWorkerClient', () => ({
  applyOnWorker: mockApplyOnWorker,
}));

import { ipcMain } from 'electron';
import { registerApplyHandlers } from './apply';

const mockEvent = { sender: {} } as any;

describe('apply IPC Route Validation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('registers the apply IPC handler', () => {
    registerApplyHandlers();
    expect(ipcMain.handle).toHaveBeenCalledWith('apply', expect.any(Function));
  });

  it('rejects invalid args object with INVALID_IPC_INPUT', async () => {
    registerApplyHandlers();
    const handler = vi.mocked(ipcMain.handle).mock.calls[0][1] as any;

    const res1 = await handler(mockEvent, null);
    expect(res1.ok).toBe(false);
    expect(res1.errors[0].code).toBe('INVALID_IPC_INPUT');

    const res2 = await handler(mockEvent, 'not-an-object');
    expect(res2.ok).toBe(false);
    expect(res2.errors[0].code).toBe('INVALID_IPC_INPUT');
  });

  it('rejects missing repoRoot or blank previewToken with INVALID_IPC_INPUT', async () => {
    registerApplyHandlers();
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
    registerApplyHandlers();
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
    registerApplyHandlers();
    const handler = vi.mocked(ipcMain.handle).mock.calls[0][1] as any;

    mockRequireTrustedRepoRoot.mockReturnValue('/trusted-root-path');
    mockApplyOnWorker.mockResolvedValue({ ok: true, appliedFileCount: 1, historyEntries: [] });

    const args = {
      repoRoot: '/renderer-supplied-path',
      previewToken: 'some-token',
      extraField: 'should-be-ignored',
    };

    const response = await handler(mockEvent, args);
    expect(response.ok).toBe(true);

    expect(mockRequireTrustedRepoRoot).toHaveBeenCalledWith(mockEvent, '/renderer-supplied-path');
    expect(mockApplyOnWorker).toHaveBeenCalledWith({
      trustedRepoRoot: '/trusted-root-path',
      previewToken: 'some-token',
    });
  });

  it('sanitizes unexpected main-process failures and hides raw messages', async () => {
    registerApplyHandlers();
    const handler = vi.mocked(ipcMain.handle).mock.calls[0][1] as any;

    mockRequireTrustedRepoRoot.mockImplementation(() => {
      throw new Error('Fatal error revealing internal DB connection details');
    });

    const response = await handler(mockEvent, { repoRoot: '/repo', previewToken: 'token' });
    expect(response.ok).toBe(false);
    expect(response.errors[0].code).toBe('UNEXPECTED_SYSTEM_ERROR');
    expect(response.errors[0].message).toBe('apply request failed.');
    expect(response.errors[0].message).not.toContain('revealing internal DB');
  });
});
