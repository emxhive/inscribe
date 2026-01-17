import type { ReviewItem } from '@/types';
import { buildReviewItems } from '@/utils';
import {
  parseIntakeStructure,
  updateDirectiveInText,
  type IntakeDirectiveKey,
} from '@/utils/intake';

type DirectiveUpdates = Partial<Record<string, string>>;

const mergeReviewItems = (
  nextItems: ReviewItem[],
  previousItems: ReviewItem[]
): ReviewItem[] => {
  const previousMap = new Map(previousItems.map((item) => [item.id, item]));

  return nextItems.map((item) => {
    const previous = previousMap.get(item.id);
    if (!previous) {
      return item;
    }

    const editedContent = previous.editedContent;
    let status = item.status;

    if (status !== 'invalid') {
      if (previous.status === 'applied') {
        status = 'applied';
      } else if (editedContent !== item.originalContent) {
        status = 'pending';
      }
    }

    return {
      ...item,
      editedContent,
      status,
    };
  });
};

export async function updateDirectivesAndRebuild({
  aiInput,
  reviewItems,
  repoRoot,
  targetItemId,
  updates,
}: {
  aiInput: string;
  reviewItems: ReviewItem[];
  repoRoot: string | null;
  targetItemId: string;
  updates: DirectiveUpdates;
}) {
  const targetItem = reviewItems.find((item) => item.id === targetItemId);
  if (!targetItem) {
    return { error: 'Unable to locate review item.' };
  }

  let nextInput = aiInput;
  for (const [key, value] of Object.entries(updates)) {
    const intake = parseIntakeStructure(nextInput);
    const targetBlock = intake.blocks.find((block) => block.index === targetItem.blockIndex);
    if (!targetBlock) {
      return { error: 'Unable to locate block directives.' };
    }
    nextInput = updateDirectiveInText(
      nextInput,
      targetBlock,
      key as IntakeDirectiveKey,
      value ?? '',
      { allowEmptyInsert: true },
    );
  }

  const parseResult = await window.inscribeAPI.parseBlocks(nextInput);
  if (parseResult.errors && parseResult.errors.length > 0) {
    return {
      error: `Directive update failed: ${parseResult.errors[0]}`,
      parseErrors: parseResult.errors,
    };
  }

  const validationErrors = await window.inscribeAPI.validateBlocks(
    parseResult.blocks || [],
    repoRoot || '',
  );
  const nextItems = buildReviewItems(parseResult.blocks || [], validationErrors || []);

  return {
    nextInput,
    parsedBlocks: parseResult.blocks || [],
    validationErrors: validationErrors || [],
    reviewItems: mergeReviewItems(nextItems, reviewItems),
  };
}
