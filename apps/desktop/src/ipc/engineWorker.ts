import { parentPort, workerData } from 'worker_threads';

if (workerData) {
  process.env.INSCRIBE_USER_DATA = workerData;
}

import { runPreviewWorker } from './previewWorker';
import { runApplyWorker } from './applyWorker';

if (!parentPort) {
  process.exit(1);
}

parentPort.on('message', async (message: { id: string; action: string; payload: any }) => {
  const { id, action, payload } = message;

  try {
    let result: any;
    if (action === 'preview') {
      const result = await runPreviewWorker(payload);
      parentPort!.postMessage({ id, success: true, result });
    } else if (action === 'apply') {
      const result = await runApplyWorker(payload);
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
