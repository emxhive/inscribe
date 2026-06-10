# Legacy V1 Engine

This directory contains a frozen snapshot of the V1 text-coordinate engine, its tests, configurations, shared structures, and relevant desktop IPC/UI assets.

This snapshot is frozen for historical reference before migrating to the V2 structural-engine.
Do not import from or run tests within this directory.

## Copied Desktop Files
The following files from `apps/desktop/src/` were copied to preserve the V1 review and engine IPC pipeline context:
- `ipc/apply.ts`: Pipeline orchestration for applying V1 operations.
- `ipc/engineWorker.ts`: Worker thread context executing the V1 engine pipeline.
- `ipc/engineWorkerClient.ts`: IPC client communicating with the worker thread.
- `utils/reviewComparison.ts` & `utils/reviewComparison.test.ts`: Calculations of review comparisons/diffs.
- `utils/review.ts` & `utils/review.test.ts`: Review model states and parsing.
- `components/Preview.tsx`: Diff renderer and comparison view.
- `components/app/ReviewPanel.tsx`: High-level review and comparison display UI component.
