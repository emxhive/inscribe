import {
  describe,
  expect,
  it,
} from 'vitest';
import { initialState } from './useAppState';
import { applyAppStateUpdates } from './appStateUtils';

describe('applyAppStateUpdates', () => {
  it('merges only the supplied fields', () => {
    const prev = {
      ...initialState,
      aiInput: 'old input',
      lastAppliedActionId: 'action-1',
      previewSession: {
        previewToken: 'preview-token',
        expiresAt: 'later',
      },
    };

    const next =
      applyAppStateUpdates(prev, {
        aiInput: 'new input',
      });

    expect(next.aiInput).toBe(
      'new input',
    );

    expect(
      next.lastAppliedActionId,
    ).toBe('action-1');

    expect(next.previewSession).toBe(
      prev.previewSession,
    );
  });

  it('preserves explicit atomic transitions without deriving additional changes', () => {
    const reviewItems = [
      {
        id: 'operation-1',
      },
    ] as typeof initialState.reviewItems;

    const previewSession = {
      previewToken: 'preview-token',
      expiresAt: 'later',
    };

    const next =
      applyAppStateUpdates(
        initialState,
        {
          mode: 'review',
          reviewItems,
          previewSession,
        },
      );

    expect(next.mode).toBe('review');
    expect(next.reviewItems).toBe(
      reviewItems,
    );
    expect(next.previewSession).toBe(
      previewSession,
    );
  });
});