import { describe, expect, it } from 'vitest';
import type { ReviewItem, ReviewPreflightResult } from '@/types';
import {
  buildReviewItemPreflightFingerprint,
  getApplyablePendingReviewItems,
  getBlockedReviewItems,
  getReviewItemApplyState,
  getReviewApplySummary,
  getReviewSidebarError,
  getReviewSidebarStatus,
  getUnresolvedPreflightReviewItems,
  summarizeSkippedReviewItems,
  buildApplyPlanFromItems,
  V2_APPLY_BLOCKER,
} from './review';

import type { V1ReviewItem } from '@/types';

const buildItem = (overrides: Partial<V1ReviewItem> = {}): V1ReviewItem => ({
  id: '0-src/app.ts',
  file: 'src/app.ts',
  mode: 'replace_file',
  language: 'typescript',
  lineCount: 1,
  status: 'pending',
  originalContent: 'old',
  editedContent: 'new',
  blockIndex: 0,
  directives: {},
  ...overrides,
});

const passedPreflight = (item: ReviewItem): ReviewPreflightResult => ({
  status: 'passed',
  fingerprint: buildReviewItemPreflightFingerprint(item),
});

const failedPreflight = (item: ReviewItem, error = 'No range candidate matched'): ReviewPreflightResult => ({
  status: 'failed',
  fingerprint: buildReviewItemPreflightFingerprint(item),
  error,
});

describe('review item state selectors', () => {
  it('classifies a pending item with passed preflight as applyable', () => {
    const item = buildItem();
    const state = getReviewItemApplyState(item, { [item.id]: passedPreflight(item) });

    expect(state.kind).toBe('pending-applyable');
    expect(state.applyable).toBe(true);
  });

  it('blocks selected/apply paths for preview failed items', () => {
    const item = buildItem();
    const state = getReviewItemApplyState(item, { [item.id]: failedPreflight(item) });

    expect(state.kind).toBe('blocked-preflight');
    expect(state.applyable).toBe(false);
    expect(state.blocker).toBe('No range candidate matched');
  });

  it('treats missing or stale preflight as unresolved and not applyable', () => {
    const item = buildItem();
    const staleItem = { ...item, editedContent: 'stale' };
    const state = getReviewItemApplyState(item, { [item.id]: passedPreflight(staleItem) });

    expect(state.kind).toBe('pending-preflight');
    expect(state.applyable).toBe(false);
  });

  it('treats applied items as terminal even if old preflight data exists', () => {
    const item = buildItem({ status: 'applied' });
    const state = getReviewItemApplyState(item, { [item.id]: failedPreflight(item) });

    expect(state.kind).toBe('applied');
    expect(state.applyable).toBe(false);
  });

  it('derives apply valid sets from only genuinely applyable pending items', () => {
    const applyable = buildItem({ id: '0-src/app.ts', file: 'src/app.ts', blockIndex: 0 });
    const preflightBlocked = buildItem({ id: '1-src/blocked.ts', file: 'src/blocked.ts', blockIndex: 1 });
    const invalid = buildItem({
      id: '2-src/invalid.ts',
      file: 'src/invalid.ts',
      blockIndex: 2,
      status: 'invalid',
      validationError: 'File does not exist',
    });
    const unresolved = buildItem({ id: '3-src/checking.ts', file: 'src/checking.ts', blockIndex: 3 });
    const preflightByItem = {
      [applyable.id]: passedPreflight(applyable),
      [preflightBlocked.id]: failedPreflight(preflightBlocked),
    };
    const items = [applyable, preflightBlocked, invalid, unresolved];

    expect(getApplyablePendingReviewItems(items, preflightByItem)).toEqual([applyable]);
    expect(getBlockedReviewItems(items, preflightByItem)).toEqual([preflightBlocked, invalid]);
    expect(getUnresolvedPreflightReviewItems(items, preflightByItem)).toEqual([unresolved]);
    expect(summarizeSkippedReviewItems([preflightBlocked, invalid, unresolved], preflightByItem)).toBe(
      '1 validation error(s), 1 preflight blocker(s), 1 pending preflight check(s)',
    );

    const summary = getReviewApplySummary(items, preflightByItem);
    expect(summary.canApplyAll).toBe(false);
    expect(summary.canApplyValid).toBe(true);
    expect(summary.applyablePendingItems).toEqual([applyable]);
    expect(summary.preflightBlockedItems).toEqual([preflightBlocked]);
  });

  it('shows preview failed pending items as error-like in the sidebar without changing item status', () => {
    const item = buildItem();
    const preflightByItem = { [item.id]: failedPreflight(item, 'Boundary selector failed') };

    expect(item.status).toBe('pending');
    expect(getReviewSidebarStatus(item, preflightByItem)).toBe('invalid');
    expect(getReviewSidebarError(item, preflightByItem)).toBe('Boundary selector failed');
  });

  it('blocks V2 items from being applied and rejects plans containing them', () => {
    const v2Item: ReviewItem = {
      engineVersion: 'v2',
      comparisonSource: 'canonical-v2',
      id: '0-src/new.ts',
      file: 'src/new.ts',
      strategy: 'replace_text',
      executionId: 'exec-1',
      operationIndex: 0,
      blockIndex: 0,
      filePath: 'src/new.ts',
      beforeFileHash: 'hash-before',
      afterFileHash: 'hash-after',
      targetScope: { filePath: 'src/new.ts', strategy: 'replace_text' },
      beforeExists: false,
      afterExists: true,
      language: 'typescript',
      lineCount: 0,
      status: 'pending',
      originalContent: '',
      editedContent: '',
    };

    const v1Item = buildItem({ id: '1-src/app.ts', file: 'src/app.ts' });

    // V2 item apply state -> kind === 'blocked-v2-apply', applyable === false, blocker === V2_APPLY_BLOCKER
    const state = getReviewItemApplyState(v2Item, {});
    expect(state.kind).toBe('blocked-v2-apply');
    expect(state.applyable).toBe(false);
    expect(state.blocker).toBe(V2_APPLY_BLOCKER);

    // V2 sidebar status -> 'pending'
    expect(getReviewSidebarStatus(v2Item, {})).toBe('pending');

    // V2 sidebar error -> undefined
    expect(getReviewSidebarError(v2Item, {})).toBeUndefined();

    // V2 summary -> v2BlockedItems contains V2 item, canApplyAll false, canApplyValid false
    const v2Summary = getReviewApplySummary([v2Item], {});
    expect(v2Summary.v2BlockedItems).toEqual([v2Item]);
    expect(v2Summary.canApplyAll).toBe(false);
    expect(v2Summary.canApplyValid).toBe(false);

    // mixed [V1, V2] summary -> canApplyValid false, buildApplyPlanFromItems still throws V2_APPLY_BLOCKER
    const preflightByItem = {
      [v1Item.id]: passedPreflight(v1Item),
    };
    const mixedSummary = getReviewApplySummary([v1Item, v2Item], preflightByItem);
    expect(mixedSummary.canApplyValid).toBe(false);
    expect(() => buildApplyPlanFromItems([v2Item])).toThrow(V2_APPLY_BLOCKER);
    expect(() => buildApplyPlanFromItems([v1Item, v2Item])).toThrow(V2_APPLY_BLOCKER);
  });
});
