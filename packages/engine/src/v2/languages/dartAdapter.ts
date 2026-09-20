import Parser from 'web-tree-sitter';
import { treeSitterRangeToJsRange } from '../structural/treeSitterRangeToJsRange';
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

export interface DartStructuralMatch {
  kind: StructuralKind;
  name?: string;
  traversalNode: Parser.SyntaxNode;
  replacement: TreeSitterReplacementCandidate['replacement'];
}

function grammarIdForFile(_filePath: string): string {
  return 'dart';
}

export function collectDartCandidates(
  rootNode: Parser.SyntaxNode,
  query: StructuralCandidateQuery,
): readonly TreeSitterReplacementCandidate[] {
  const matches: DartStructuralMatch[] = [];
  collectDartMatches(rootNode, query.path, 0, matches, query.source);

  return matches.map((match) => ({
    kind: match.kind,
    name: match.name,
    replacement: match.replacement,
    reliabilityNode: match.traversalNode,
  }));
}

export function collectDartMatches(
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

      const structuralMatch = getDartStructuralMatch(child, source, segment.kind);
      const isMatch =
        structuralMatch?.kind === segment.kind &&
        (!segment.name || structuralMatch.name === segment.name);

      if (isMatch) {
        candidates.push(structuralMatch);
      }

      if (depth > 0 && (isDartStructuralOwner(child) || isOwnedFunctionBody(child))) {
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
      collectDartMatches(candidate.traversalNode, selectorPath, depth + 1, results, source);
    }
  }
}

export function getDartStructuralMatch(
  node: Parser.SyntaxNode,
  source: string,
  requestedKind: StructuralKind,
): DartStructuralMatch | undefined {
  if (node.type === 'class_definition') {
    return {
      kind: 'class',
      name: getDeclaredName(node),
      traversalNode: node,
      replacement: {
        type: 'range',
        range: createNormalizedNodeRange(source, findDeclarationStartNode(node), node),
      },
    };
  }

  const constructorSignature = getConstructorSignature(node);
  if (constructorSignature) {
    if (requestedKind === 'constructor') {
      return createConstructorMatch(node, constructorSignature, source);
    }
    if (requestedKind === 'method' && node.type === 'method_signature') {
      return createMethodMatch(node, source);
    }
    return undefined;
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
        range: createNormalizedNodeRange(source, findDeclarationStartNode(node), body),
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
        range: createNormalizedNodeRange(source, findDeclarationStartNode(node), body),
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

  if (node.type === 'for_statement') {
    return {
      kind: 'for_statement',
      traversalNode: node,
      replacement: { type: 'node', node },
    };
  }

  if (node.type === 'while_statement') {
    return {
      kind: 'while_statement',
      traversalNode: node,
      replacement: { type: 'node', node },
    };
  }

  if (node.type === 'switch_statement') {
    return {
      kind: 'switch_statement',
      traversalNode: node,
      replacement: { type: 'node', node },
    };
  }

  return undefined;
}

function getConstructorSignature(node: Parser.SyntaxNode): Parser.SyntaxNode | undefined {
  if (node.type !== 'declaration' && node.type !== 'method_signature') return undefined;

  const visit = (current: Parser.SyntaxNode): Parser.SyntaxNode | undefined => {
    if (isConstructorSignatureType(current.type)) return current;
    for (let index = 0; index < current.namedChildCount; index++) {
      const child = current.namedChild(index);
      if (!child) continue;
      const match = visit(child);
      if (match) return match;
    }
    return undefined;
  };

  return visit(node);
}

function isConstructorSignatureType(type: string): boolean {
  return (
    type === 'constructor_signature' ||
    type === 'factory_constructor_signature' ||
    type === 'constant_constructor_signature' ||
    type === 'redirecting_factory_constructor_signature'
  );
}

function createConstructorMatch(
  node: Parser.SyntaxNode,
  signature: Parser.SyntaxNode,
  source: string,
): DartStructuralMatch | undefined {
  const body = node.type === 'method_signature' ? findFollowingFunctionBody(node) : undefined;
  const range = createNormalizedNodeRange(source, findDeclarationStartNode(node), body ?? node);
  const endIndex = body
    ? range.endIndex
    : findBodylessDeclarationEnd(source, range.endIndex);

  return {
    kind: 'constructor',
    name: getConstructorName(signature),
    traversalNode: body ?? node,
    replacement: {
      type: 'range',
      range: {
        ...range,
        endIndex,
      },
    },
  };
}

function createMethodMatch(
  node: Parser.SyntaxNode,
  source: string,
): DartStructuralMatch | undefined {
  const body = findFollowingFunctionBody(node);
  if (!body) return undefined;
  return {
    kind: 'method',
    name: getDeclaredName(node),
    traversalNode: body,
    replacement: {
      type: 'range',
      range: createNormalizedNodeRange(source, findDeclarationStartNode(node), body),
    },
  };
}

function getConstructorName(signature: Parser.SyntaxNode): string {
  const identifiers: string[] = [];
  for (let index = 0; index < signature.namedChildCount; index++) {
    const child = signature.namedChild(index);
    if (!child) continue;
    if (child.type === 'identifier') {
      identifiers.push(child.text);
      continue;
    }
    if (child.type === 'qualified') {
      for (let nestedIndex = 0; nestedIndex < child.namedChildCount; nestedIndex++) {
        const nested = child.namedChild(nestedIndex);
        if (nested?.type === 'identifier') identifiers.push(nested.text);
      }
    }
  }
  return identifiers[1] ?? 'new';
}

/**
 * Dart's bodyless constructor declaration node stops before its terminating
 * semicolon. Extend the normalized JS range to the actual syntax boundary,
 * preserving any trivia between the signature and semicolon.
 */
function createNormalizedNodeRange(
  source: string,
  startNode: Parser.SyntaxNode,
  endNode: Parser.SyntaxNode,
): { startIndex: number; endIndex: number; coordinateSpace: 'js-utf16' } {
  return {
    startIndex: treeSitterRangeToJsRange(source, startNode).start,
    endIndex: treeSitterRangeToJsRange(source, endNode).end,
    coordinateSpace: 'js-utf16',
  };
}

function findBodylessDeclarationEnd(source: string, jsEnd: number): number {
  let cursor = jsEnd;

  while (cursor < source.length) {
    if (/\s/.test(source[cursor])) {
      cursor++;
      continue;
    }

    if (source.startsWith('//', cursor)) {
      const newline = source.indexOf('\n', cursor + 2);
      cursor = newline === -1 ? source.length : newline + 1;
      continue;
    }

    if (source.startsWith('/*', cursor)) {
      const commentEnd = source.indexOf('*/', cursor + 2);
      cursor = commentEnd === -1 ? source.length : commentEnd + 2;
      continue;
    }

    break;
  }

  if (source[cursor] !== ';') return jsEnd;

  return cursor + 1;
}

export function isDartStructuralOwner(node: Parser.SyntaxNode): boolean {
  return (
    node.type === 'class_definition' ||
    node.type === 'method_signature' ||
    isConstructorDeclaration(node) ||
    node.type === 'function_signature' ||
    node.type === 'function_expression' ||
    node.type === 'lambda_expression' ||
    node.type === 'local_function_declaration'
  );
}

function isConstructorDeclaration(node: Parser.SyntaxNode): boolean {
  return node.type === 'declaration' && getConstructorSignature(node) !== undefined;
}

function isOwnedFunctionBody(node: Parser.SyntaxNode): boolean {
  if (node.type !== 'function_body') return false;
  const parent = node.parent;
  if (!parent) return false;

  for (let index = 1; index < parent.namedChildCount; index++) {
    if (parent.namedChild(index)?.startIndex !== node.startIndex) continue;
    const preceding = parent.namedChild(index - 1);
    return preceding ? isDartStructuralOwner(preceding) : false;
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

function findDeclarationStartNode(node: Parser.SyntaxNode): Parser.SyntaxNode {
  const parent = node.parent;
  if (!parent) return node;

  let nodeIndex = -1;
  for (let index = 0; index < parent.namedChildCount; index++) {
    if (parent.namedChild(index)?.startIndex === node.startIndex) {
      nodeIndex = index;
      break;
    }
  }
  if (nodeIndex < 0) return node;

  let startNode = node;
  for (let index = nodeIndex - 1; index >= 0; index--) {
    const sibling = parent.namedChild(index);
    if (!sibling || !isDartAnnotation(sibling)) break;
    startNode = sibling;
  }
  return startNode;
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
    collectCandidates: collectDartCandidates,
  }, assets);
}
