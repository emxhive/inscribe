import Parser from 'web-tree-sitter';
import type {
  V2StructuralParserDiagnostic,
  V2StructuralParserFailure,
} from '@inscribe/shared';
import {
  treeSitterByteRangeToJsRange,
  treeSitterRangeToJsRange,
} from '../structural/treeSitterRangeToJsRange';
import {
  createParser,
  initTreeSitter,
  loadLanguageForGrammar,
  TreeSitterAssetPaths,
} from '../structural/treeSitterRuntime';
import {
  StructuralCandidate,
  StructuralCandidateQuery,
  StructuralCandidateReliability,
  StructuralCandidateResolution,
  StructuralKind,
  TreeSitterLanguageAdapter,
} from './types';

/**
 * Internal Tree-sitter candidate shape used by adapter implementations.
 *
 * `replacement` is deliberately required: a semantic match node is not
 * sufficient when the logical replacement boundary is an enclosing wrapper
 * or a declaration assembled from sibling nodes.
 */
export interface TreeSitterReplacementRange {
  /** Offsets for the logical replacement boundary. */
  startIndex: number;
  endIndex: number;
  /** Explicit ranges default to UTF-8 byte offsets for compatibility. */
  coordinateSpace?: 'utf8-byte' | 'js-utf16';
}

export type TreeSitterReplacement =
  | { type: 'node'; node: Parser.SyntaxNode }
  | { type: 'range'; range: TreeSitterReplacementRange };

export interface TreeSitterReplacementCandidate {
  kind: StructuralKind;
  name?: string;
  /** The logical replacement boundary, never merely the semantic match node. */
  replacement: TreeSitterReplacement;
  /**
   * Node whose ownership and local error state must be trusted before the
   * replacement range can be exposed to the language-neutral resolver.
   */
  reliabilityNode?: Parser.SyntaxNode;
}

export interface TreeSitterLanguageAdapterDefinition {
  id: string;
  extensions: readonly string[];
  supportedKinds: readonly StructuralKind[];
  grammarIdForFile(filePath: string): string;
  collectCandidates(
    rootNode: Parser.SyntaxNode,
    query: StructuralCandidateQuery,
  ): readonly TreeSitterReplacementCandidate[];
}

interface TreeSitterDiagnosticSet {
  diagnostics: readonly V2StructuralParserDiagnostic[];
  totalDiagnostics: number;
}

/**
 * Builds a V2 adapter around a Tree-sitter grammar.
 *
 * Tree-sitter nodes are confined to the collector callback. The adapter's
 * public result is converted immediately to logical JS UTF-16 ranges.
 */
export function createTreeSitterLanguageAdapter(
  definition: TreeSitterLanguageAdapterDefinition,
  assets: TreeSitterAssetPaths,
): TreeSitterLanguageAdapter {
  return {
    id: definition.id,
    extensions: definition.extensions,
    structural: {
      supportedKinds: definition.supportedKinds,
      async resolveCandidates(query): Promise<StructuralCandidateResolution> {
        const grammarId = definition.grammarIdForFile(query.filePath);
        return withParsedTree(query, assets, grammarId, (rootNode, diagnosticSet) => {
          const diagnostics = diagnosticSet.diagnostics;
          const candidates = definition.collectCandidates(rootNode, query);
          if (candidates.length === 0 && diagnostics.length > 0) {
            // An empty result is normally TARGET_NOT_FOUND, but a damaged
            // recovered tree cannot prove that absence safely. Preserve the
            // parser evidence instead of converting uncertainty into a false
            // negative structural lookup.
            return {
              candidates: [],
              unresolvedParser: createParserFailure(
                definition.id,
                grammarId,
                diagnostics,
                diagnosticSet.totalDiagnostics,
              ),
            };
          }
          const convertedCandidates = candidates.map((candidate) => {
            const range = candidate.replacement.type === 'node'
              ? treeSitterRangeToJsRange(query.source, candidate.replacement.node)
              : candidate.replacement.range.coordinateSpace === 'js-utf16'
                ? {
                  start: candidate.replacement.range.startIndex,
                  end: candidate.replacement.range.endIndex,
                }
                : treeSitterByteRangeToJsRange(query.source, candidate.replacement.range);

            return {
              candidate,
              range,
              reliability: assessCandidateReliability(
                query.source,
                definition.id,
                grammarId,
                candidate,
                range,
                diagnosticSet,
              ),
            };
          });

          const structuralCandidates = convertedCandidates.map(({ candidate, range, reliability }) =>
            reliability
              ? {
                kind: candidate.kind,
                name: candidate.name,
                start: range.start,
                end: range.end,
                reliability,
              }
              : {
                kind: candidate.kind,
                name: candidate.name,
                start: range.start,
                end: range.end,
              },
          );

          return structuralCandidates.some((candidate) => candidate.reliability)
            ? { candidates: structuralCandidates }
            : structuralCandidates;
        });
      },
    },
    grammarIdForFile: definition.grammarIdForFile,
  };
}

async function withParsedTree<T>(
  query: StructuralCandidateQuery,
  assets: TreeSitterAssetPaths,
  grammarId: string,
  callback: (
    rootNode: Parser.SyntaxNode,
    diagnostics: TreeSitterDiagnosticSet,
  ) => T | Promise<T>,
): Promise<T> {
  try {
    await initTreeSitter(assets);
  } catch (_) {
    throw new Error('RUNTIME_INITIALIZATION_FAILED');
  }

  let language: Parser.Language;
  try {
    language = await loadLanguageForGrammar(assets, grammarId);
  } catch (_) {
    throw new Error('MISSING_WASM_ASSET');
  }

  const parser = createParser();
  let tree: Parser.Tree | undefined;

  try {
    try {
      parser.setLanguage(language);
      tree = parser.parse(query.source);
    } catch (_) {
      throw new Error('RUNTIME_INITIALIZATION_FAILED');
    }
    const diagnostics = collectParserDiagnostics(tree.rootNode, query.source);
    return await callback(tree.rootNode, diagnostics);
  } finally {
    try {
      tree?.delete();
    } catch (_) {}
    try {
      parser.delete();
    } catch (_) {}
  }
}

function collectParserDiagnostics(
  rootNode: Parser.SyntaxNode,
  source: string,
): TreeSitterDiagnosticSet {
  const diagnostics: V2StructuralParserDiagnostic[] = [];

  function visit(node: Parser.SyntaxNode): void {
    const isError = node.type === 'ERROR';
    const isMissing = node.isMissing();
    if (isError || isMissing) {
      const range = treeSitterRangeToJsRange(source, node);
      const start = pointForOffset(source, range.start);
      const end = pointForOffset(source, range.end);
      diagnostics.push({
        condition: isMissing ? 'MISSING_NODE' : 'ERROR_NODE',
        nodeType: node.type,
        startIndex: range.start,
        endIndex: range.end,
        startLine: start.line,
        startColumn: start.column,
        endLine: end.line,
        endColumn: end.column,
        context: createDiagnosticContext(source, range.start, range.end),
      });
      // The outermost recovery node is the useful diagnostic. Descendants
      // would only duplicate the same damaged region.
      return;
    }

    for (const child of node.children) visit(child);
  }

  visit(rootNode);
  return {
    diagnostics,
    totalDiagnostics: diagnostics.length,
  };
}

function pointForOffset(source: string, offset: number): { line: number; column: number } {
  const safeOffset = Math.max(0, Math.min(source.length, offset));
  const before = source.slice(0, safeOffset);
  const lastNewline = before.lastIndexOf('\n');
  return {
    line: before.split('\n').length,
    column: safeOffset - (lastNewline + 1),
  };
}

function assessCandidateReliability(
  source: string,
  adapterId: string,
  grammarId: string,
  candidate: TreeSitterReplacementCandidate,
  range: { start: number; end: number },
  diagnosticSet: TreeSitterDiagnosticSet,
): StructuralCandidateReliability | undefined {
  const diagnostics = diagnosticSet.diagnostics;
  const replacementNode = candidate.replacement.type === 'node'
    ? candidate.replacement.node
    : undefined;
  const reliabilityNode = candidate.reliabilityNode ?? replacementNode;

  const relevantDiagnostics = diagnostics.filter((diagnostic) =>
    rangesOverlapOrTouch(diagnostic.startIndex, diagnostic.endIndex, range.start, range.end),
  );

  if (!reliabilityNode && diagnostics.length > 0) {
    return {
      trustworthy: false,
      structuralParser: createParserFailure(
        adapterId,
        grammarId,
        diagnostics,
        diagnosticSet.totalDiagnostics,
      ),
    };
  }

  if (reliabilityNode) {
    const reliabilityRange = treeSitterRangeToJsRange(source, reliabilityNode);
    if (reliabilityRange.start < range.start || reliabilityRange.end > range.end) {
      return unreliableCandidate(
        adapterId,
        grammarId,
        diagnostics,
        diagnosticSet.totalDiagnostics,
        reliabilityNode,
        source,
      );
    }

    if (reliabilityNode.type === 'ERROR' || reliabilityNode.isMissing() || hasErrorAncestor(reliabilityNode)) {
      return unreliableCandidate(
        adapterId,
        grammarId,
        relevantDiagnostics,
        diagnosticSet.totalDiagnostics,
        reliabilityNode,
        source,
      );
    }

    const touchingSibling = [reliabilityNode.previousSibling, reliabilityNode.nextSibling]
      .find((sibling) => sibling && isRecoveryNode(sibling));
    if (touchingSibling) {
      return unreliableCandidate(
        adapterId,
        grammarId,
        relevantDiagnostics,
        diagnosticSet.totalDiagnostics,
        touchingSibling,
        source,
      );
    }
  }

  if (relevantDiagnostics.length > 0) {
    return {
      trustworthy: false,
      structuralParser: createParserFailure(
        adapterId,
        grammarId,
        relevantDiagnostics,
        diagnosticSet.totalDiagnostics,
      ),
    };
  }

  return undefined;
}

function hasErrorAncestor(node: Parser.SyntaxNode): boolean {
  let current = node.parent;
  while (current) {
    if (isRecoveryNode(current)) return true;
    current = current.parent;
  }
  return false;
}

function isRecoveryNode(node: Parser.SyntaxNode): boolean {
  return node.type === 'ERROR' || node.isMissing();
}

function rangesOverlapOrTouch(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
): boolean {
  return firstStart <= secondEnd && firstEnd >= secondStart;
}

function unreliableCandidate(
  adapterId: string,
  grammarId: string,
  diagnostics: readonly V2StructuralParserDiagnostic[],
  totalDiagnostics: number,
  node: Parser.SyntaxNode,
  source: string,
): StructuralCandidateReliability {
  const nodeRange = treeSitterRangeToJsRange(source, node);
  const fallback: V2StructuralParserDiagnostic = {
    condition: node.isMissing() ? 'MISSING_NODE' : 'ERROR_NODE',
    nodeType: node.type,
    startIndex: nodeRange.start,
    endIndex: nodeRange.end,
    ...(() => {
      const start = pointForOffset(source, nodeRange.start);
      const end = pointForOffset(source, nodeRange.end);
      return {
        startLine: start.line,
        startColumn: start.column,
        endLine: end.line,
        endColumn: end.column,
        context: createDiagnosticContext(source, nodeRange.start, nodeRange.end),
      };
    })(),
  };
  return {
    trustworthy: false,
    structuralParser: createParserFailure(
      adapterId,
      grammarId,
      diagnostics.length > 0 ? diagnostics : [fallback],
      totalDiagnostics,
    ),
  };
}

const MAX_DIAGNOSTIC_CONTEXT_LENGTH = 240;
const MAX_DIAGNOSTICS_IN_FAILURE = 20;

function createParserFailure(
  adapterId: string,
  grammarId: string,
  diagnostics: readonly V2StructuralParserDiagnostic[],
  totalDiagnostics: number,
): V2StructuralParserFailure {
  const limitedDiagnostics = diagnostics.slice(0, MAX_DIAGNOSTICS_IN_FAILURE);
  return {
    parser: 'tree-sitter',
    adapterId,
    grammarId,
    diagnostics: [...limitedDiagnostics],
    totalDiagnostics,
    diagnosticsTruncated: diagnostics.length > limitedDiagnostics.length || totalDiagnostics > diagnostics.length,
  };
}

function createDiagnosticContext(source: string, start: number, end: number): string {
  const contextStart = Math.max(0, start - 96);
  const contextEnd = Math.min(source.length, Math.max(end, start) + 96);
  const context = source.slice(contextStart, contextEnd);
  if (context.length <= MAX_DIAGNOSTIC_CONTEXT_LENGTH) return context;

  const headLength = Math.floor((MAX_DIAGNOSTIC_CONTEXT_LENGTH - 1) / 2);
  const tailLength = MAX_DIAGNOSTIC_CONTEXT_LENGTH - headLength - 1;
  return `${context.slice(0, headLength)}…${context.slice(-tailLength)}`;
}
