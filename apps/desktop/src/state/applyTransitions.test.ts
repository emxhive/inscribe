import { describe, expect, it } from 'vitest';
import type { HistoryEntry } from '@inscribe/shared';
import type { ApplyErrorDTO } from '@/ipc/applyTypes';
import type { AppState } from '@/types';
import {
  buildApplyFailureUpdate,
  buildApplyFinishedUpdate,
  buildApplyRequestFailureUpdate,
  buildApplyStartedUpdate,
  buildApplySuccessUpdate,
  buildApplyUnavailableUpdate,
  resolveAppliedActionId,
} from './applyTransitions';

describe('apply state transitions', () => {
  it('describes why an unavailable apply cannot run', () => {
    expect(
      buildApplyUnavailableUpdate(false),
    ).toEqual({
      statusMessage:
        'preview session is unavailable. Preview the changes again.',
    });

    expect(
      buildApplyUnavailableUpdate(true),
    ).toEqual({
      statusMessage:
        'This preview has already been applied. Preview again to apply new changes.',
    });
  });

  it('starts apply with the reviewed file count', () => {
    expect(
      buildApplyStartedUpdate(2),
    ).toEqual({
      isApplyingInProgress: true,
      pipelineStatus: 'applying',
      statusMessage:
        'Applying preview (2 files)...',
    });
  });

  it('invalidates the preview session when apply is rejected', () => {
    const errors = [
      {
        code: 'TARGET_NOT_FOUND',
        filePath: 'src/example.ts',
        message: 'Target not found.',
      },
    ] as ApplyErrorDTO[];

    expect(
      buildApplyFailureUpdate(errors),
    ).toMatchObject({
      previewSession: null,
      pipelineStatus: 'apply-failure',
      statusMessage:
        'TARGET_NOT_FOUND in src/example.ts: Target not found.',
    });
  });

  it('builds one atomic successful apply transition', () => {
    const reviewItems = [
      {
        id: 'operation-1',
        status: 'pending',
      },
      {
        id: 'operation-2',
        status: 'pending',
      },
    ] as AppState['reviewItems'];

    const previousHistoryItems = [
      { id: 'old-entry' },
    ] as AppState['historyItems'];

    const newHistoryItems = [
      { id: 'new-entry' },
    ] as AppState['historyItems'];

    const terminalCommandSuggestions = [
      { command: 'npm test' },
    ] as AppState['terminalCommandSuggestions'];

    const update =
      buildApplySuccessUpdate({
        reviewItems,
        previousHistoryItems,
        newHistoryItems,
        appliedActionId: 'action-1',
        appliedFileCount: 2,
        terminalCommandSuggestions,
      });

    expect(
      update.reviewItems?.every(
        (item) => item.status === 'applied',
      ),
    ).toBe(true);

    expect(update.historyItems).toEqual([
      ...newHistoryItems,
      ...previousHistoryItems,
    ]);

    expect(update).toMatchObject({
      previewSession: null,
      lastAppliedActionId: 'action-1',
      pipelineStatus: 'apply-success',
      statusMessage:
        '✓ Applied preview: 2 file(s).',
      terminalCommandSuggestions,
    });
  });

  it('preserves existing terminal suggestions when apply yields none', () => {
    const update =
      buildApplySuccessUpdate({
        reviewItems: [] as AppState['reviewItems'],
        previousHistoryItems:
          [] as AppState['historyItems'],
        newHistoryItems:
          [] as AppState['historyItems'],
        appliedActionId: 'action-1',
        appliedFileCount: 0,
        terminalCommandSuggestions: [],
      });

    expect(update).not.toHaveProperty(
      'terminalCommandSuggestions',
    );
  });

  it('resolves the modern action id with the legacy apply id as fallback', () => {
    const modern = [
      {
        actionId: 'action-1',
        applyId: 'apply-1',
      },
    ] as HistoryEntry[];

    const fallback = [
      {
        applyId: 'apply-2',
      },
    ] as HistoryEntry[];

    expect(
      resolveAppliedActionId(modern),
    ).toBe('action-1');

    expect(
      resolveAppliedActionId(fallback),
    ).toBe('apply-2');

    expect(
      resolveAppliedActionId(undefined),
    ).toBeNull();
  });

  it('normalizes request failure and completion', () => {
    expect(
      buildApplyRequestFailureUpdate(),
    ).toEqual({
      previewSession: null,
      pipelineStatus: 'apply-failure',
      statusMessage:
        'Failed to apply preview.',
    });

    expect(
      buildApplyFinishedUpdate(),
    ).toEqual({
      isApplyingInProgress: false,
    });
  });
});