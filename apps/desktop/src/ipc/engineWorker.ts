import { parentPort, workerData } from 'worker_threads';

if (workerData) {
  process.env.INSCRIBE_USER_DATA = workerData;
}

import {
  applyChanges,
  buildOperationComparison,
  restoreEntry,
} from '@inscribe/engine';
import { runPreviewV2Worker } from './previewV2Worker';

if (!parentPort) {
  process.exit(1);
}

parentPort.on('message', async (message: { id: string; action: string; payload: any }) => {
  const { id, action, payload } = message;

  try {
    let result: any;
    if (action === 'compare-operation') {
      result = buildOperationComparison(payload.operation, payload.repoRoot);
      parentPort!.postMessage({ id, success: true, result });
    } else if (action === 'apply-changes') {
      result = applyChanges(payload.plan, payload.repoRoot);
      parentPort!.postMessage({ id, success: true, result });
    } else if (action === 'restore-entry') {
      result = restoreEntry(payload.request, payload.repoRoot);
      parentPort!.postMessage({ id, success: true, result });
    } else if (action === 'preview_v2') {
      const result = await runPreviewV2Worker(payload);
      parentPort!.postMessage({ id, success: true, result });
    } else {
      throw new Error(`Unknown worker action: ${action}`);
    }
  } catch (error) {
    parentPort!.postMessage({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
