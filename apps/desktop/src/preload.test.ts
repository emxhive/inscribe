import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn(),
  },
  ipcRenderer: {
    invoke: vi.fn(),
  },
}));

import { contextBridge, ipcRenderer } from 'electron';
import './preload';

describe('preload applyV2', () => {
  it('exposes applyV2 on window.inscribeAPI and invokes apply-v2 channel', async () => {
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith('inscribeAPI', expect.any(Object));
    const exposedApi = vi.mocked(contextBridge.exposeInMainWorld).mock.calls[0][1] as any;
    expect(exposedApi.applyV2).toBeDefined();

    vi.mocked(ipcRenderer.invoke).mockResolvedValue({ ok: true });
    const res = await exposedApi.applyV2({ repoRoot: '/repo', previewToken: 'token' });
    expect(res).toEqual({ ok: true });
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('apply-v2', { repoRoot: '/repo', previewToken: 'token' });
  });
});
