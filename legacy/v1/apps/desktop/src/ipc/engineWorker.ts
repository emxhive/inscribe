import { parentPort, workerData } from 'worker_threads';

if (workerData) {
  process.env.INSCRIBE_USER_DATA = workerData;
}

import {
  applyChanges,
  buildOperationComparison,
  restoreEntry,
} from '@inscribe/engine';

if (!parentPort) {
  process.exit(1);
}

parentPort.on('message', (message: { id: string; action: string; payload: any }) => {
  const { id, action, payload } = message;

  try {
    let result: any;
    if (action === 'compare-operation') {
      result = buildOperationComparison(payload.operation, payload.repoRoot);
    } else if (action === 'apply-changes') {
      result = applyChanges(payload.plan, payload.repoRoot);
    } else if (action === 'restore-entry') {
      result = restoreEntry(payload.request, payload.repoRoot);
    } else {
      throw new Error(`Unknown worker action: ${action}`);
    }

    parentPort!.postMessage({ id, success: true, result });
  } catch (error) {
    parentPort!.postMessage({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
