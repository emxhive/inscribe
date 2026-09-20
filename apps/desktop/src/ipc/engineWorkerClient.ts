import { Worker } from 'worker_threads';
import * as path from 'path';
import { app } from 'electron';
import type { PreviewWorkerPayload, PreviewWorkerResponse } from './previewTypes';
import type { ApplyWorkerPayload, ApplyWorkerResponse } from './applyTypes';

let worker: Worker | null = null;
const pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
let requestIdCounter = 0;

function nextRequestId(): string {
  requestIdCounter += 1;
  return `req-${requestIdCounter}-${Date.now()}`;
}

function handleWorkerCrash(err: Error) {
  // Reject all pending requests
  for (const pending of pendingRequests.values()) {
    pending.reject(new Error(`Worker crashed: ${err.message}`));
  }
  // Clear pending requests before terminating the failed worker.
  pendingRequests.clear();

  // Dispose of the failed worker reference
  if (worker) {
    worker.removeAllListeners();
    worker.terminate().catch(() => {});
    worker = null;
  }
}

function getWorker(): Worker {
  if (worker) {
    return worker;
  }

  const workerPath = path.join(__dirname, 'engineWorker.js');
  const userDataPath = typeof app !== 'undefined' && typeof app.getPath === 'function' ? app.getPath('userData') : '';
  worker = new Worker(workerPath, { workerData: userDataPath });

  worker.on('message', (message: { id: string; success: boolean; result?: any; error?: string }) => {
    const { id, success, result, error } = message;
    const pending = pendingRequests.get(id);
    if (!pending) return;

    pendingRequests.delete(id);
    if (success) {
      pending.resolve(result);
    } else {
      pending.reject(new Error(error || 'Unknown worker error'));
    }
  });

  worker.on('error', (err) => {
    handleWorkerCrash(err);
  });

  worker.on('exit', (code) => {
    if (code !== 0) {
      handleWorkerCrash(new Error(`Worker exited with code ${code}`));
    }
  });

  return worker;
}

function executeOnWorker(action: string, payload: any): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const w = getWorker();
      const id = nextRequestId();
      pendingRequests.set(id, { resolve, reject });
      w.postMessage({ id, action, payload });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Executes preview operations on the worker.
 */
export function previewOnWorker(payload: PreviewWorkerPayload): Promise<PreviewWorkerResponse> {
  return executeOnWorker('preview', payload);
}

/**
 * Executes apply operations on the worker.
 */
export function applyOnWorker(payload: ApplyWorkerPayload): Promise<ApplyWorkerResponse> {
  return executeOnWorker('apply', payload);
}

/**
 * Disposes the worker thread client and terminates the worker.
 */
export function dispose() {
  for (const pending of pendingRequests.values()) {
    pending.reject(new Error('Worker disposed'));
  }
  pendingRequests.clear();
  if (worker) {
    worker.removeAllListeners();
    worker.terminate().catch(() => {});
    worker = null;
  }
}
