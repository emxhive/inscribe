import Parser from 'web-tree-sitter';
import { TreeSitterAssetPaths } from '../structural/treeSitterRuntime';
import {
  StructuralCandidateQuery,
  StructuralKind,
  StructuralSelectorSegment,
  TreeSitterLanguageAdapter,
  V2_STRUCTURAL_KINDS,
} from './types';
import {
  createTreeSitterLanguageAdapter,
  TreeSitterReplacementCandidate,
} from './treeSitterAdapter';

const DART_EXTENSIONS = ['.dart'] as const;

interface DartStructuralMatch {
  kind: StructuralKind;
  name?: string;
  traversalNode: Parser.SyntaxNode;
  replacement: TreeSitterReplacementCandidate['replacement'];
}

function grammarIdForFile(_filePath: string): string {
  return 'dart';
}

function collectCandidates(
  rootNode: Parser.SyntaxNode,
  query: StructuralCandidateQuery,
): readonly TreeSitterReplacementCandidate[] {
  const matches: DartStructuralMatch[] = [];
  collectMatches(rootNode, query.path, 0, matches, query.source);

  return matches.map((match) => ({
    kind: match.kind,
    name: match.name,
    replacement: match.replacement,
  }));
}

function collectMatches(
  currentNode: Parser.SyntaxNode,
  selectorPath: readonly StructuralSelectorSegment[],
  depth: number,
  results: DartStructuralMatch[],
  source: string,
): void {
  const segment = selectorPath[depth];
  const isLast = depth === selectorPath.length - 1;
  const candidates: DartStructuralMatch[] = [];

  function traverse(node: Parser.SyntaxNode): void {
    for (let index = 0; index < node.namedChildCount; index++) {
      const child = node.namedChild(index);
      if (!child) continue;

      const structuralMatch = getStructuralMatch(child, source);
      const isMatch =
        structuralMatch?.kind === segment.kind &&
        (!segment.name || structuralMatch.name === segment.name);

      if (isMatch) {
        candidates.push(structuralMatch);
      }

      if (depth > 0 && (isStructuralOwner(child) || isOwnedFunctionBody(child))) {
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
      collectMatches(candidate.traversalNode, selectorPath, depth + 1, results, source);
    }
  }
}

function getStructuralMatch(node: Parser.SyntaxNode, source: string): DartStructuralMatch | undefined {
  if (node.type === 'class_definition') {
    return {
      kind: 'class',
      name: getDeclaredName(node),
      traversalNode: node,
      replacement: { type: 'node', node },
    };
  }

  if (node.type === 'method_signature') {
    const body = findFollowingFunctionBody(node);
    if (!body) return undefined;
    return {
      kind: 'method',
      name: getDeclaredName(node),
      traversalNode: body,
      replacement: {
        type: 'range',
        range: {
          startIndex: findDeclarationStart(node),
          endIndex: body.endIndex,
          text: source.slice(findDeclarationStart(node), body.endIndex),
        },
      },
    };
  }

  if (node.type === 'function_signature' && node.parent?.type === 'program') {
    const body = findFollowingFunctionBody(node);
    if (!body) return undefined;
    return {
      kind: 'function',
      name: getDeclaredName(node),
      traversalNode: body,
      replacement: {
        type: 'range',
        range: {
          startIndex: findDeclarationStart(node),
          endIndex: body.endIndex,
          text: source.slice(findDeclarationStart(node), body.endIndex),
        },
      },
    };
  }

  if (node.type === 'if_statement') {
    return {
      kind: 'if_statement',
      traversalNode: node,
      replacement: { type: 'node', node },
    };
  }

  return undefined;
}

function isStructuralOwner(node: Parser.SyntaxNode): boolean {
  return (
    node.type === 'class_definition' ||
    node.type === 'method_signature' ||
    (node.type === 'function_signature' && node.parent?.type === 'program')
  );
}

function isOwnedFunctionBody(node: Parser.SyntaxNode): boolean {
  if (node.type !== 'function_body') return false;
  const parent = node.parent;
  if (!parent) return false;

  for (let index = 1; index < parent.namedChildCount; index++) {
    if (parent.namedChild(index)?.startIndex !== node.startIndex) continue;
    const preceding = parent.namedChild(index - 1);
    return preceding ? isStructuralOwner(preceding) : false;
  }
  return false;
}

function findFollowingFunctionBody(node: Parser.SyntaxNode): Parser.SyntaxNode | undefined {
  const parent = node.parent;
  if (!parent) return undefined;

  let nodeIndex = -1;
  for (let index = 0; index < parent.namedChildCount; index++) {
    if (parent.namedChild(index)?.startIndex === node.startIndex) {
      nodeIndex = index;
      break;
    }
  }
  if (nodeIndex < 0) return undefined;

  for (let index = nodeIndex + 1; index < parent.namedChildCount; index++) {
    const sibling = parent.namedChild(index);
    if (!sibling) continue;
    if (sibling.type === 'function_body') return sibling;
    if (sibling.startIndex >= node.endIndex) break;
  }
  return undefined;
}

function findDeclarationStart(node: Parser.SyntaxNode): number {
  const parent = node.parent;
  if (!parent) return node.startIndex;

  let nodeIndex = -1;
  for (let index = 0; index < parent.namedChildCount; index++) {
    if (parent.namedChild(index)?.startIndex === node.startIndex) {
      nodeIndex = index;
      break;
    }
  }
  if (nodeIndex < 0) return node.startIndex;

  let startIndex = node.startIndex;
  for (let index = nodeIndex - 1; index >= 0; index--) {
    const sibling = parent.namedChild(index);
    if (!sibling || !isDartAnnotation(sibling)) break;
    startIndex = sibling.startIndex;
  }
  return startIndex;
}

function isDartAnnotation(node: Parser.SyntaxNode): boolean {
  return node.type === 'annotation' || node.type === 'marker_annotation';
}

function getDeclaredName(node: Parser.SyntaxNode): string | undefined {
  const directName = node.childForFieldName('name');
  if (directName) return directName.text;

  for (let index = 0; index < node.namedChildCount; index++) {
    const child = node.namedChild(index);
    if (!child) continue;
    const nestedName = child.childForFieldName('name');
    if (nestedName) return nestedName.text;
  }
  return undefined;
}

export function createDartLanguageAdapter(
  assets: TreeSitterAssetPaths,
): TreeSitterLanguageAdapter {
  return createTreeSitterLanguageAdapter({
    id: 'dart-v2',
    extensions: DART_EXTENSIONS,
    supportedKinds: V2_STRUCTURAL_KINDS,
    grammarIdForFile,
    collectCandidates,
  }, assets);
}
