import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockRequireTrustedRepoRoot = vi.hoisted(() => vi.fn());
const mockPreviewV2OnWorker = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock('./trustedRepo', () => ({
  requireTrustedRepoRoot: mockRequireTrustedRepoRoot,
}));

vi.mock('./engineWorkerClient', () => ({
  previewV2OnWorker: mockPreviewV2OnWorker,
}));

import { ipcMain } from 'electron';
import { registerPreviewV2Handlers } from './previewV2';

// Simple mocked electron event
const mockEvent = { sender: {} } as any;

describe('preview-v2 IPC Route Validation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('registers the preview-v2 IPC handler', () => {
    registerPreviewV2Handlers();
    expect(ipcMain.handle).toHaveBeenCalledWith('preview-v2', expect.any(Function));
  });

  it('rejects invalid args object with INVALID_IPC_INPUT', async () => {
    registerPreviewV2Handlers();
    const handler = vi.mocked(ipcMain.handle).mock.calls[0][1] as any;

    const res1 = await handler(mockEvent, null);
    expect(res1.ok).toBe(false);
    expect(res1.errors[0].code).toBe('INVALID_IPC_INPUT');

    const res2 = await handler(mockEvent, 'not-an-object');
    expect(res2.ok).toBe(false);
    expect(res2.errors[0].code).toBe('INVALID_IPC_INPUT');
  });

  it('rejects missing repoRoot or rawInput with INVALID_IPC_INPUT', async () => {
    registerPreviewV2Handlers();
    const handler = vi.mocked(ipcMain.handle).mock.calls[0][1] as any;

    const res1 = await handler(mockEvent, { rawInput: 'abc' });
    expect(res1.ok).toBe(false);
    expect(res1.errors[0].code).toBe('INVALID_IPC_INPUT');

    const res2 = await handler(mockEvent, { repoRoot: '/repo' });
    expect(res2.ok).toBe(false);
    expect(res2.errors[0].code).toBe('INVALID_IPC_INPUT');
  });

  it('uses requireTrustedRepoRoot and ignores renderer-supplied assetPaths', async () => {
    registerPreviewV2Handlers();
    const handler = vi.mocked(ipcMain.handle).mock.calls[0][1] as any;

    mockRequireTrustedRepoRoot.mockReturnValue('/trusted-root-path');
    mockPreviewV2OnWorker.mockResolvedValue({
      ok: true,
      partial: false,
      executions: [],
      errors: [],
      previewToken: 'token',
      expiresAt: '2026-01-01T00:00:00.000Z',
    });

    const args = {
      repoRoot: '/renderer-supplied-path',
      rawInput: '<<<INSCRIBE...',
      assetPaths: { coreWasmPath: '/renderer/core.wasm' }, // should be ignored
    };

    const response = await handler(mockEvent, args);
    expect(response.ok).toBe(true);

    // requireTrustedRepoRoot called with renderer path to verify against active window
    expect(mockRequireTrustedRepoRoot).toHaveBeenCalledWith(mockEvent, '/renderer-supplied-path');

    // previewV2OnWorker should receive trusted root and internally derived paths, ignoring args.assetPaths
    expect(mockPreviewV2OnWorker).toHaveBeenCalledWith(
      expect.objectContaining({
        trustedRepoRoot: '/trusted-root-path',
        rawInput: '<<<INSCRIBE...',
        assetPaths: expect.not.objectContaining({ coreWasmPath: '/renderer/core.wasm' }),
      })
    );
  });
});
