import type { ApplyPlan, ParsedBlock, ValidationError } from '@inscribe/shared';

import { getLanguageFromFilename } from './language';
import { countLines } from './text';
import type { ReviewItem, V1ReviewItem, ReviewPreflightResult } from '@/types';

/**
 * Review item construction utilities
 */

/**
 * Build review items from parsed blocks and validation errors
 */
export function buildReviewItems(
  blocks: ParsedBlock[],
  validationErrors: ValidationError[]
): ReviewItem[] {
  // Create a map of blockIndex to validation errors
  const errorMap = new Map<number, ValidationError[]>();
  for (const error of validationErrors) {
    const errors = errorMap.get(error.blockIndex) || [];
    errors.push(error);
    errorMap.set(error.blockIndex, errors);
  }

  return blocks.map((block): ReviewItem => {
    const errors = errorMap.get(block.blockIndex) || [];
    const hasErrors = errors.length > 0;
    const validationError = hasErrors ? errors.map((e) => e.message).join('; ') : undefined;
    const status: ReviewItem['status'] = hasErrors ? 'invalid' : 'pending';

    return {
      id: `${block.blockIndex}-${block.file}`,
      file: block.file,
      mode: block.mode,
      language: getLanguageFromFilename(block.file),
      lineCount: countLines(block.content),
      status,
      originalContent: block.content,
      editedContent: block.content,
      validationError,
      blockIndex: block.blockIndex,
      directives: block.directives,
    };
  });
}

export const V2_APPLY_BLOCKER = 'V2 preview applies as one session. Use Apply All.';

/**
 * Build an apply plan from review items
 */
export function buildApplyPlanFromItems(items: ReviewItem[]): ApplyPlan {
  const hasV2 = items.some((item) => item.engineVersion === 'v2');
  if (hasV2) {
    throw new Error(V2_APPLY_BLOCKER);
  }
  const v1Items = items as V1ReviewItem[];
  return {
    operations: v1Items.map((item) => ({
      type: item.mode,
      file: item.file,
      content: item.editedContent,
      directives: item.directives,
      blockIndex: item.blockIndex,
    })),
  };
}

export type ReviewItemApplyState =
  | {
      kind: 'applied';
      applyable: false;
      blocker: null;
    }
  | {
      kind: 'pending-applyable';
      applyable: true;
      blocker: null;
    }
  | {
      kind: 'blocked-static-validation';
      applyable: false;
      blocker: string;
    }
  | {
      kind: 'blocked-preflight';
      applyable: false;
      blocker: string;
    }
  | {
      kind: 'pending-preflight';
      applyable: false;
      blocker: string;
    }
  | {
      kind: 'blocked-v2-apply';
      applyable: false;
      blocker: string;
    };

export type ReviewSidebarStatus = ReviewItem['status'];

const DEFAULT_PREFLIGHT_BLOCKER = 'Review comparison/preflight failed.';
const PENDING_PREFLIGHT_BLOCKER = 'Review comparison/preflight has not completed.';

export function buildReviewItemPreflightFingerprint(item: ReviewItem): string {
  if (item.engineVersion === 'v2') {
    return JSON.stringify({
      engineVersion: item.engineVersion,
      executionId: item.executionId,
      operationIndex: item.operationIndex,
      filePath: item.filePath,
      strategy: item.strategy,
      beforeFileHash: item.beforeFileHash,
      afterFileHash: item.afterFileHash,
      beforeExists: item.beforeExists,
      afterExists: item.afterExists,
    });
  }
  return JSON.stringify({
    file: item.file,
    mode: item.mode,
    content: item.editedContent,
    directives: Object.fromEntries(
      Object.entries(item.directives).sort(([left], [right]) => left.localeCompare(right)),
    ),
    blockIndex: item.blockIndex,
  });
}

export function getCurrentReviewPreflight(
  item: ReviewItem,
  preflightByItem: Record<string, ReviewPreflightResult>,
): ReviewPreflightResult | null {
  const preflight = preflightByItem[item.id];
  if (!preflight) {
    return null;
  }
  return preflight.fingerprint === buildReviewItemPreflightFingerprint(item) ? preflight : null;
}

export function getReviewItemApplyState(
  item: ReviewItem,
  preflightByItem: Record<string, ReviewPreflightResult>,
): ReviewItemApplyState {
  if (item.engineVersion === 'v2') {
    return {
      kind: 'blocked-v2-apply',
      applyable: false,
      blocker: V2_APPLY_BLOCKER,
    };
  }

  if (item.status === 'applied') {
    return { kind: 'applied', applyable: false, blocker: null };
  }

  if (item.status === 'invalid') {
    return {
      kind: 'blocked-static-validation',
      applyable: false,
      blocker: item.validationError ?? 'Static validation failed.',
    };
  }

  const preflight = getCurrentReviewPreflight(item, preflightByItem);
  if (!preflight || preflight.status === 'checking') {
    return {
      kind: 'pending-preflight',
      applyable: false,
      blocker: PENDING_PREFLIGHT_BLOCKER,
    };
  }

  if (preflight.status === 'failed') {
    return {
      kind: 'blocked-preflight',
      applyable: false,
      blocker: preflight.error ?? DEFAULT_PREFLIGHT_BLOCKER,
    };
  }

  return { kind: 'pending-applyable', applyable: true, blocker: null };
}

export function getReviewSidebarStatus(
  item: ReviewItem,
  preflightByItem: Record<string, ReviewPreflightResult>,
): ReviewSidebarStatus {
  const itemState = getReviewItemApplyState(item, preflightByItem);
  return itemState.kind === 'blocked-preflight' ? 'invalid' : item.status;
}

export function getReviewSidebarError(
  item: ReviewItem,
  preflightByItem: Record<string, ReviewPreflightResult>,
): string | undefined {
  const itemState = getReviewItemApplyState(item, preflightByItem);
  if (itemState.kind === 'blocked-static-validation' || itemState.kind === 'blocked-preflight') {
    return itemState.blocker;
  }
  return undefined;
}

export function getApplyablePendingReviewItems(
  items: ReviewItem[],
  preflightByItem: Record<string, ReviewPreflightResult>,
): ReviewItem[] {
  return items.filter((item) => getReviewItemApplyState(item, preflightByItem).applyable);
}

export interface ReviewApplySummary {
  appliedItems: ReviewItem[];
  pendingItems: ReviewItem[];
  applyablePendingItems: ReviewItem[];
  staticBlockedItems: ReviewItem[];
  preflightBlockedItems: ReviewItem[];
  unresolvedPreflightItems: ReviewItem[];
  v2BlockedItems: ReviewItem[];
  canApplyAll: boolean;
  canApplyValid: boolean;
}

export function getReviewApplySummary(
  items: ReviewItem[],
  preflightByItem: Record<string, ReviewPreflightResult>,
): ReviewApplySummary {
  const appliedItems: ReviewItem[] = [];
  const pendingItems: ReviewItem[] = [];
  const applyablePendingItems: ReviewItem[] = [];
  const staticBlockedItems: ReviewItem[] = [];
  const preflightBlockedItems: ReviewItem[] = [];
  const unresolvedPreflightItems: ReviewItem[] = [];
  const v2BlockedItems: ReviewItem[] = [];

  items.forEach((item) => {
    const itemState = getReviewItemApplyState(item, preflightByItem);
    if (itemState.kind === 'applied') {
      appliedItems.push(item);
      return;
    }
    if (item.status === 'pending') {
      pendingItems.push(item);
    }
    if (itemState.kind === 'blocked-v2-apply') {
      v2BlockedItems.push(item);
    } else if (itemState.kind === 'pending-applyable') {
      applyablePendingItems.push(item);
    } else if (itemState.kind === 'blocked-static-validation') {
      staticBlockedItems.push(item);
    } else if (itemState.kind === 'blocked-preflight') {
      preflightBlockedItems.push(item);
    } else if (itemState.kind === 'pending-preflight') {
      unresolvedPreflightItems.push(item);
    }
  });

  const hasV2 = v2BlockedItems.length > 0;

  return {
    appliedItems,
    pendingItems,
    applyablePendingItems,
    staticBlockedItems,
    preflightBlockedItems,
    unresolvedPreflightItems,
    v2BlockedItems,
    canApplyAll:
      !hasV2 &&
      pendingItems.length > 0 &&
      appliedItems.length === 0 &&
      staticBlockedItems.length === 0 &&
      preflightBlockedItems.length === 0 &&
      unresolvedPreflightItems.length === 0,
    canApplyValid: !hasV2 && applyablePendingItems.length > 0,
  };
}

export function getBlockedReviewItems(
  items: ReviewItem[],
  preflightByItem: Record<string, ReviewPreflightResult>,
): ReviewItem[] {
  return items.filter((item) => {
    const itemState = getReviewItemApplyState(item, preflightByItem);
    return (
      itemState.kind === 'blocked-static-validation' ||
      itemState.kind === 'blocked-preflight' ||
      itemState.kind === 'blocked-v2-apply'
    );
  });
}

export function getUnresolvedPreflightReviewItems(
  items: ReviewItem[],
  preflightByItem: Record<string, ReviewPreflightResult>,
): ReviewItem[] {
  return items.filter((item) => getReviewItemApplyState(item, preflightByItem).kind === 'pending-preflight');
}

export function summarizeSkippedReviewItems(
  items: ReviewItem[],
  preflightByItem: Record<string, ReviewPreflightResult>,
): string {
  const validationCount = items.filter(
    (item) => getReviewItemApplyState(item, preflightByItem).kind === 'blocked-static-validation',
  ).length;
  const preflightCount = items.filter(
    (item) => getReviewItemApplyState(item, preflightByItem).kind === 'blocked-preflight',
  ).length;
  const unresolvedCount = items.filter(
    (item) => getReviewItemApplyState(item, preflightByItem).kind === 'pending-preflight',
  ).length;
  const v2Count = items.filter(
    (item) => getReviewItemApplyState(item, preflightByItem).kind === 'blocked-v2-apply',
  ).length;
  const parts = [
    validationCount > 0 ? `${validationCount} validation error(s)` : null,
    preflightCount > 0 ? `${preflightCount} preflight blocker(s)` : null,
    unresolvedCount > 0 ? `${unresolvedCount} pending preflight check(s)` : null,
    v2Count > 0 ? `${v2Count} V2 blocker(s)` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : '0 skipped';
}
