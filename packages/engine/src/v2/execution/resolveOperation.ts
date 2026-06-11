import { V2Operation, V2TargetScope, V2RawPayload, V2NormalizedPayload } from '@inscribe/shared';
import { CanonicalExecution } from '../protocol';
import { VirtualFileState, hashContent } from './virtualFileState';
import { detectDestinationEOL, normalizeLineEndings } from './normalizeLineEndings';
import { performReplaceText } from '../text/exactMatch';
import { computeDiffHunks } from '../diff';
import { ResolveStructuralTargetOptions, StructuralNodeMatch, StructuralResolver } from '../structural';

export interface V2ExecutionContext {
  structuralResolver?: StructuralResolver;
}

let idCounter = 0;
function nextId(): string {
  idCounter++;
  return `exec-${idCounter}-${Math.random().toString(10).substring(2, 8)}`;
}

export async function resolveOperation(
  operation: V2Operation,
  virtualState: VirtualFileState,
  context: V2ExecutionContext = {}
): Promise<CanonicalExecution> {
  const filePath = operation.filePath;
  const strategy = operation.strategy;

  const fileItem = virtualState.get(filePath);
  const beforeExists = !!fileItem?.exists;
  const beforeContentRaw = beforeExists ? fileItem!.content : '';
  const beforeFileHash = hashContent(beforeContentRaw);

  const payloadContent = operation.strategy === 'delete_file' ? '' : operation.content;
  const destinationEOL = detectDestinationEOL(beforeContentRaw, payloadContent);

  const normalizedContent = normalizeLineEndings(payloadContent, destinationEOL);

  let afterExists = true;
  let afterContent = '';
  let beforeRange: { start: number; end: number } | undefined;
  let afterRange: { start: number; end: number } | undefined;

  const rawDirectives: Record<string, string> = {};
  const normalizedDirectives: Record<string, string> = {};

  if (operation.strategy === 'create_file') {
    if (beforeExists) {
      throw new Error(`File already exists: ${filePath}`);
    }
    afterExists = true;
    afterContent = normalizedContent;
    afterRange = { start: 0, end: normalizedContent.length };
  } else if (operation.strategy === 'replace_file') {
    if (!beforeExists) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    afterExists = true;
    afterContent = normalizedContent;
    beforeRange = { start: 0, end: beforeContentRaw.length };
    afterRange = { start: 0, end: normalizedContent.length };
  } else if (operation.strategy === 'delete_file') {
    if (!beforeExists) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    afterExists = false;
    afterContent = '';
    beforeRange = { start: 0, end: beforeContentRaw.length };
  } else if (operation.strategy === 'replace_text') {
    if (!beforeExists) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    const searchString = operation.search;
    if (searchString === undefined) {
      throw new Error('SEARCH directive is required for replace_text strategy.');
    }
    const normalizedSearch = normalizeLineEndings(searchString, destinationEOL);
    rawDirectives.SEARCH = searchString;
    normalizedDirectives.SEARCH = normalizedSearch;

    afterExists = true;
    const replaceResult = performReplaceText(beforeContentRaw, normalizedSearch, normalizedContent);
    afterContent = replaceResult.afterContent;
    beforeRange = replaceResult.beforeRange;
    afterRange = replaceResult.afterRange;
  } else if (operation.strategy === 'replace_node') {
    if (!beforeExists) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    if (!context.structuralResolver) {
      throw new Error('STRUCTURAL_RESOLVER_REQUIRED');
    }
    const resolverOptions: ResolveStructuralTargetOptions = {
      source: beforeContentRaw,
      filePath,
      selector: operation.selector,
    };
    const match = await context.structuralResolver(resolverOptions);
    beforeRange = { start: match.start, end: match.end };

    const beforePart = beforeContentRaw.slice(0, match.start);
    const afterPart = beforeContentRaw.slice(match.end);
    afterContent = beforePart + normalizedContent + afterPart;
    afterExists = true;
    afterRange = { start: match.start, end: match.start + normalizedContent.length };
  } else {
    throw new Error(`Unsupported operation strategy: ${strategy}`);
  }

  const targetScope: V2TargetScope = {
    filePath,
    strategy,
    selector: (operation.strategy === 'replace_node') ? operation.selector : undefined,
    selectorText: undefined,
    beforeRange,
    afterRange
  };

  const diffHunks = computeDiffHunks(beforeContentRaw, afterContent);
  const afterFileHash = afterExists ? hashContent(afterContent) : hashContent('');

  const rawPayload: V2RawPayload = {
    strategy,
    filePath,
    content: payloadContent,
    directives: rawDirectives
  };

  const normalizedPayload: V2NormalizedPayload = {
    strategy,
    filePath,
    content: normalizedContent,
    directives: normalizedDirectives
  };

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
