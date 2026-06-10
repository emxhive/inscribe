import { V2RawPayload, V2NormalizedPayload, V2TargetScope, V2DiffHunk } from '@inscribe/shared';
import { CanonicalExecution } from '../protocol';
import { VirtualFileState, hashContent } from './virtualFileState';
import { detectDestinationEOL, normalizeLineEndings } from './normalizeLineEndings';
import { performReplaceText } from '../text/exactMatch';
import { computeDiffHunks } from '../diff';

let idCounter = 0;
function nextId(): string {
  idCounter++;
  return `exec-${idCounter}-${Math.random().toString(10).substring(2, 8)}`;
}

export function resolveOperation(
  rawPayload: V2RawPayload,
  virtualState: VirtualFileState
): CanonicalExecution {
  const filePath = rawPayload.filePath;
  const strategy = rawPayload.strategy;
  const directives = rawPayload.directives || {};

  const fileItem = virtualState.get(filePath);
  const beforeExists = !!fileItem?.exists;
  const beforeContentRaw = beforeExists ? fileItem!.content : '';
  const beforeFileHash = hashContent(beforeContentRaw);

  const destinationEOL = detectDestinationEOL(beforeContentRaw, rawPayload.content);

  const normalizedContent = normalizeLineEndings(rawPayload.content, destinationEOL);

  const normalizedDirectives: Record<string, string> = {};
  for (const key of Object.keys(directives)) {
    normalizedDirectives[key] = normalizeLineEndings(directives[key], destinationEOL);
  }

  const normalizedPayload: V2NormalizedPayload = {
    strategy,
    filePath,
    content: normalizedContent,
    directives: normalizedDirectives
  };

  let afterExists = true;
  let afterContent = '';
  let beforeRange: { start: number; end: number } | undefined;
  let afterRange: { start: number; end: number } | undefined;

  if (strategy === 'create_file') {
    if (beforeExists) {
      throw new Error(`File already exists: ${filePath}`);
    }
    afterExists = true;
    afterContent = normalizedContent;
    afterRange = { start: 0, end: normalizedContent.length };
  } else if (strategy === 'replace_file') {
    if (!beforeExists) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    afterExists = true;
    afterContent = normalizedContent;
    beforeRange = { start: 0, end: beforeContentRaw.length };
    afterRange = { start: 0, end: normalizedContent.length };
  } else if (strategy === 'delete_file') {
    if (!beforeExists) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    afterExists = false;
    afterContent = '';
    beforeRange = { start: 0, end: beforeContentRaw.length };
  } else if (strategy === 'replace_text') {
    if (!beforeExists) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    const searchString = normalizedDirectives.SEARCH;
    if (searchString === undefined) {
      throw new Error('SEARCH directive is required for replace_text strategy.');
    }
    afterExists = true;
    const replaceResult = performReplaceText(beforeContentRaw, searchString, normalizedContent);
    afterContent = replaceResult.afterContent;
    beforeRange = replaceResult.beforeRange;
    afterRange = replaceResult.afterRange;
  } else {
    throw new Error(`Unsupported operation strategy: ${strategy}`);
  }

  const selector = normalizedDirectives.SEARCH ?? '';
  const targetScope: V2TargetScope = {
    filePath,
    strategy,
    selector: selector || undefined,
    beforeRange,
    afterRange
  };

  const diffHunks = computeDiffHunks(beforeContentRaw, afterContent);
  const afterFileHash = afterExists ? hashContent(afterContent) : hashContent('');

  return {
    executionId: nextId(),
    filePath,
    strategy,
    targetScope,
    rawPayload,
    normalizedPayload,
    beforeExists,
    afterExists,
    beforeContent: beforeContentRaw,
    afterContent,
    actualDiffHunks: diffHunks,
    beforeFileHash,
    afterFileHash
  };
}
