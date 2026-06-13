import { Worker } from 'worker_threads';
import * as path from 'path';
import { app } from 'electron';
import type { PreviewV2WorkerPayload, PreviewV2WorkerResponse } from './previewV2Types';
import type { ApplyV2WorkerPayload, ApplyV2WorkerResponse } from './applyV2Types';

let worker: Worker | null = null;
const pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
const inFlightComparisons = new Map<string, Promise<any>>();
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
  // Clear pending maps and comparison dedupe entries
  pendingRequests.clear();
  inFlightComparisons.clear();

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

function getCompareKey(repoRoot: string, operation: any): string {
  const directives = operation.directives || {};
  const sortedKeys = Object.keys(directives).sort();
  const sortedDirectives: Record<string, any> = {};
  for (const key of sortedKeys) {
    sortedDirectives[key] = directives[key];
  }
  return JSON.stringify({
    repoRoot,
    file: operation.file,
    type: operation.type,
    content: operation.content,
    directives: sortedDirectives,
  });
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
 * Executes a compare-operation on the worker with in-flight deduplication.
 */
export function compareOperation(operation: any, repoRoot: string): Promise<any> {
  const key = getCompareKey(repoRoot, operation);
  const existing = inFlightComparisons.get(key);
  if (existing) {
    return existing;
  }

  const promise = executeOnWorker('compare-operation', { operation, repoRoot })
    .then((res) => {
      inFlightComparisons.delete(key);
      return res;
    })
    .catch((err) => {
      inFlightComparisons.delete(key);
      throw err;
    });

  inFlightComparisons.set(key, promise);
  return promise;
}

/**
 * Executes apply-changes on the worker.
 */
export function applyChangesOnWorker(plan: any, repoRoot: string): Promise<any> {
  return executeOnWorker('apply-changes', { plan, repoRoot });
}

/**
 * Executes restore-entry on the worker.
 */
export function restoreEntryOnWorker(request: any, repoRoot: string): Promise<any> {
  return executeOnWorker('restore-entry', { request, repoRoot });
}



/**
 * Executes V2 preview operations on the worker.
 */
export function previewV2OnWorker(payload: PreviewV2WorkerPayload): Promise<PreviewV2WorkerResponse> {
  return executeOnWorker('preview_v2', payload);
}

/**
 * Executes V2 apply operations on the worker.
 */
export function applyV2OnWorker(payload: ApplyV2WorkerPayload): Promise<ApplyV2WorkerResponse> {
  return executeOnWorker('apply_v2', payload);
}

/**
 * Disposes the worker thread client and terminates the worker.
 */
export function dispose() {
  inFlightComparisons.clear();
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
