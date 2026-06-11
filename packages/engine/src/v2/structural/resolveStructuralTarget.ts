import Parser from 'web-tree-sitter';
import * as path from 'path';
import { StructuralSelector, StructuralNodeMatch, StructuralSelectorSegment } from './types';
import { treeSitterRangeToJsRange } from './treeSitterRangeToJsRange';
import { initTreeSitter, loadLanguage, createParser, TreeSitterAssetPaths } from './treeSitterRuntime';
import { isNodeOfKind, getNodeName, isStructuralOwner, getLogicalReplacementNode } from './tsxAdapter';
import { matchesStartsWith } from './startsWithQualifier';

export interface ResolveStructuralTargetOptions {
  source: string;
  filePath: string;
  selector: StructuralSelector;
}

export type StructuralResolver = (
  options: ResolveStructuralTargetOptions
) => Promise<StructuralNodeMatch>;

export function createStructuralResolver(
  assets: TreeSitterAssetPaths
): StructuralResolver {
  return async (options: ResolveStructuralTargetOptions): Promise<StructuralNodeMatch> => {
    // Resolver boundary validation
    if (
      !options.selector ||
      !Array.isArray(options.selector.path) ||
      options.selector.path.length === 0
    ) {
      throw new Error('INVALID_SELECTOR');
    }

    if (
      options.selector.startsWith !== undefined &&
      (typeof options.selector.startsWith !== 'string' || options.selector.startsWith.trim() === '')
    ) {
      throw new Error('INVALID_SELECTOR');
    }

    const SUPPORTED = new Set(['class', 'method', 'function', 'if_statement']);
    for (const seg of options.selector.path) {
      if (!seg || !seg.kind || !SUPPORTED.has(seg.kind)) {
        throw new Error('INVALID_SELECTOR');
      }
      if (
        seg.name !== undefined &&
        (typeof seg.name !== 'string' || seg.name.trim() === '')
      ) {
        throw new Error('INVALID_SELECTOR');
      }
    }

    const ext = path.extname(options.filePath).toLowerCase();
    if (ext !== '.ts' && ext !== '.tsx') {
      throw new Error('UNSUPPORTED_EXTENSION');
    }

    try {
      await initTreeSitter(assets);
    } catch (err) {
      throw new Error('RUNTIME_INITIALIZATION_FAILED');
    }

    let language;
    try {
      if (ext === '.tsx') {
        language = await loadLanguage(assets.tsxWasmPath);
      } else {
        language = await loadLanguage(assets.typescriptWasmPath);
      }
    } catch (err) {
      throw new Error('MISSING_WASM_ASSET');
    }

    let parser: Parser | undefined;
    let tree: Parser.Tree | undefined;

    try {
      parser = createParser();
      parser.setLanguage(language);

      try {
        tree = parser.parse(options.source);
      } catch (err) {
        throw new Error('RUNTIME_INITIALIZATION_FAILED');
      }

      if (tree.rootNode.hasError()) {
        throw new Error('PARSER_DIAGNOSTICS_PRESENT');
      }

      let matchedNodes: Parser.SyntaxNode[] = [];
      collectMatches(tree.rootNode, options.selector.path, 0, matchedNodes);

      const anyPathMatched = matchedNodes.length > 0;

      const lastKind = options.selector.path[options.selector.path.length - 1].kind;

      if (options.selector.startsWith) {
        matchedNodes = matchedNodes.filter((node) => {
          const replacementNode = getLogicalReplacementNode(node, lastKind);
          const { start, end } = treeSitterRangeToJsRange(options.source, replacementNode);
          const candidateSource = options.source.slice(start, end);
          return matchesStartsWith(candidateSource, options.selector.startsWith!);
        });
      }

      if (matchedNodes.length === 0) {
        if (anyPathMatched && options.selector.startsWith) {
          throw new Error('TARGET_QUALIFIER_NOT_MATCHED');
        }
        throw new Error('TARGET_NOT_FOUND');
      }

      if (matchedNodes.length > 1) {
        throw new Error('TARGET_AMBIGUOUS');
      }

      const matchedNode = matchedNodes[0];
      const replacementNode = getLogicalReplacementNode(matchedNode, lastKind);
      const { start, end } = treeSitterRangeToJsRange(options.source, replacementNode);

      return {
        kind: lastKind,
        name: getNodeName(matchedNode),
        start,
        end,
      };
    } finally {
      if (tree) {
        try {
          tree.delete();
        } catch (_) {}
      }
      if (parser) {
        try {
          parser.delete();
        } catch (_) {}
      }
    }
  };
}

function collectMatches(
  currentNode: Parser.SyntaxNode,
  path: StructuralSelectorSegment[],
  depth: number,
  results: Parser.SyntaxNode[]
) {
  const segment = path[depth];
  const isLast = depth === path.length - 1;

  const candidates: Parser.SyntaxNode[] = [];

  function traverse(node: Parser.SyntaxNode) {
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (!child) continue;

      const isMatch =
        isNodeOfKind(child, segment.kind) &&
        (!segment.name || getNodeName(child) === segment.name);

      if (isMatch) {
        candidates.push(child);
      }

      const isOwner = isStructuralOwner(child);
      if (depth > 0 && isOwner) {
        continue;
      }

      traverse(child);
    }
  }

  traverse(currentNode);

  for (const candidate of candidates) {
    if (isLast) {
      results.push(candidate);
    } else {
      collectMatches(candidate, path, depth + 1, results);
    }
  }
}
