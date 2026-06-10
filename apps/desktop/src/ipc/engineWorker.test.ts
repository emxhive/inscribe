import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockPostMessage = vi.hoisted(() => vi.fn());
const mockTerminate = vi.hoisted(() => vi.fn().mockResolvedValue(0));
const mockOn = vi.hoisted(() => vi.fn());
const mockRemoveAllListeners = vi.hoisted(() => vi.fn());
const mockWorkerConstructor = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mocked/user-data-path'),
  },
}));

vi.mock('worker_threads', () => ({
  parentPort: {
    on: vi.fn(),
    postMessage: vi.fn(),
  },
  workerData: '/mocked/user-data-path',
  Worker: class {
    constructor(...args: any[]) {
      mockWorkerConstructor(...args);
    }
    postMessage = mockPostMessage;
    terminate = mockTerminate;
    on = mockOn;
    removeAllListeners = mockRemoveAllListeners;
  }
}));

import {
  compareOperation,
  applyChangesOnWorker,
  dispose,
} from './engineWorkerClient';

describe('engineWorkerClient', () => {
  beforeEach(() => {
    mockPostMessage.mockClear();
    mockTerminate.mockClear();
    mockOn.mockClear();
    mockRemoveAllListeners.mockClear();
    dispose();
  });

  it('lazily instantiates worker and sends message', async () => {
    let messageHandler: any;
    mockOn.mockImplementation((event, handler) => {
      if (event === 'message') {
        messageHandler = handler;
      }
    });

    const promise = compareOperation({ file: 'foo.dart', type: 'replace_symbol', content: 'src' }, '/repo');

    expect(mockOn).toHaveBeenCalled();
    expect(mockPostMessage).toHaveBeenCalled();

    const sentPayload = mockPostMessage.mock.calls[0][0];
    expect(sentPayload.action).toBe('compare-operation');
    expect(sentPayload.id).toBeDefined();

    // Simulate successful worker reply
    messageHandler({ id: sentPayload.id, success: true, result: { compared: true } });

    const result = await promise;
    expect(result).toEqual({ compared: true });
  });

  it('deduplicates identical in-flight comparisons', async () => {
    let messageHandler: any;
    mockOn.mockImplementation((event, handler) => {
      if (event === 'message') {
        messageHandler = handler;
      }
    });

    const op = { file: 'foo.dart', type: 'replace_symbol', content: 'src', directives: { b: 2, a: 1 } };
    const p1 = compareOperation(op, '/repo');
    const p2 = compareOperation({ ...op, directives: { a: 1, b: 2 } }, '/repo');

    expect(mockPostMessage).toHaveBeenCalledTimes(1);

    const sentPayload = mockPostMessage.mock.calls[0][0];
    messageHandler({ id: sentPayload.id, success: true, result: { ok: true } });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual({ ok: true });
    expect(r2).toEqual({ ok: true });
  });

  it('handles worker errors and rejects pending requests without replaying them', async () => {
    let errorHandler: any;
    mockOn.mockImplementation((event, handler) => {
      if (event === 'error') {
        errorHandler = handler;
      }
    });

    const promise = applyChangesOnWorker({ blocks: [] }, '/repo');

    // Simulate crash
    errorHandler(new Error('SyntaxError in worker'));

    await expect(promise).rejects.toThrow('Worker crashed: SyntaxError in worker');
  });

  it('passes userDataPath to Worker constructor via workerData', async () => {
    mockWorkerConstructor.mockClear();
    compareOperation({ file: 'foo.dart', type: 'replace_symbol', content: 'src' }, '/repo').catch(() => {});
    expect(mockWorkerConstructor).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        workerData: '/mocked/user-data-path',
      })
    );
  });

  it('worker sets INSCRIBE_USER_DATA from workerData on startup', async () => {
    const originalUserData = process.env.INSCRIBE_USER_DATA;
    delete process.env.INSCRIBE_USER_DATA;

    // Dynamically require engineWorker to run its startup logic
    await import('./engineWorker');

    expect(process.env.INSCRIBE_USER_DATA).toBe('/mocked/user-data-path');

    // Restore original state
    process.env.INSCRIBE_USER_DATA = originalUserData;
  });
});
