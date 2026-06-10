import Parser from 'web-tree-sitter';
import { StructuralSelector, StructuralNodeMatch, StructuralKind } from './types';
import { matchesStartsWith } from './startsWithQualifier';

const KIND_MAP: Record<StructuralKind, string[]> = {
  class: ['class_declaration'],
  method: ['method_definition'],
  function: ['function_declaration', 'generator_function_declaration'],
  if_statement: ['if_statement'],
};

function getNodeName(node: Parser.SyntaxNode): string | undefined {
  const nameNode = node.childForFieldName('name');
  return nameNode ? nameNode.text : undefined;
}

export function treeSitterRangeToJsRange(
  source: string,
  node: { startIndex: number; endIndex: number; text: string }
): { start: number; end: number } {
  const directSlice = source.slice(node.startIndex, node.endIndex);
  if (directSlice === node.text) {
    return { start: node.startIndex, end: node.endIndex };
  }

  // Fallback: UTF-8 byte offset to UTF-16 code unit mapping
  const encoder = new TextEncoder();
  const bytes = encoder.encode(source);

  const byteToCharIndex = new Int32Array(bytes.length + 1);
  let charIndex = 0;
  let byteIndex = 0;

  while (charIndex < source.length) {
    const codePoint = source.codePointAt(charIndex)!;
    const charLength = codePoint > 0xffff ? 2 : 1;
    const sliceStr = source.slice(charIndex, charIndex + charLength);
    const utf8Length = encoder.encode(sliceStr).length;

    for (let i = 0; i < utf8Length; i++) {
      byteToCharIndex[byteIndex + i] = charIndex;
    }
    byteIndex += utf8Length;
    charIndex += charLength;
  }
  byteToCharIndex[byteIndex] = source.length;

  return {
    start: byteToCharIndex[node.startIndex] ?? node.startIndex,
    end: byteToCharIndex[node.endIndex] ?? node.endIndex,
  };
}

function collectMatches(
  currentNode: Parser.SyntaxNode,
  path: { kind: StructuralKind; name?: string }[],
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

      const types = KIND_MAP[segment.kind];
      if (types && types.includes(child.type)) {
        if (!segment.name || getNodeName(child) === segment.name) {
          candidates.push(child);
        }
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

export function resolveNodeRange(
  source: string,
  tree: Parser.Tree,
  selector: StructuralSelector
): StructuralNodeMatch {
  let matchedNodes: Parser.SyntaxNode[] = [];
  collectMatches(tree.rootNode, selector.path, 0, matchedNodes);

  if (selector.startsWith) {
    matchedNodes = matchedNodes.filter((node) => {
      const lastNewLine = source.lastIndexOf('\n', node.startIndex);
      const lineStart = lastNewLine === -1 ? 0 : lastNewLine + 1;
      const candidateSource = source.slice(lineStart, node.endIndex);
      return matchesStartsWith(candidateSource, selector.startsWith!);
    });
  }

  if (matchedNodes.length === 0) {
    throw new Error('TARGET_NOT_FOUND');
  }

  if (matchedNodes.length > 1) {
    throw new Error('TARGET_AMBIGUOUS');
  }

  const matchedNode = matchedNodes[0];
  const { start, end } = treeSitterRangeToJsRange(source, matchedNode);

  return {
    kind: selector.path[selector.path.length - 1].kind,
    name: getNodeName(matchedNode),
    start,
    end,
  };
}
