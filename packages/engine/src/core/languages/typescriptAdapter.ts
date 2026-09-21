import * as path from "path";
import Parser from "web-tree-sitter";
import {
  getLogicalReplacementNode,
  getNodeName,
  isNodeOfKind,
  isStructuralOwner,
} from "../structural/tsxAdapter";
import { treeSitterRangeToJsRange } from "../structural/treeSitterRangeToJsRange";
import type { TreeSitterParserEvidence } from "../structural/treeSitterParserEvidence";
import { TreeSitterAssetPaths } from "../structural/treeSitterRuntime";
import {
  StructuralCandidateQuery,
  StructuralSelectorSegment,
  TreeSitterLanguageAdapter,
  STRUCTURAL_KINDS,
} from "./types";
import {
  createTreeSitterLanguageAdapter,
  TreeSitterReplacement,
  TreeSitterReplacementCandidate,
} from "./treeSitterAdapter";

const TYPESCRIPT_EXTENSIONS = [".ts", ".tsx"] as const;

function grammarIdForFile(filePath: string): string {
  return path.extname(filePath).toLowerCase() === ".tsx" ? "tsx" : "typescript";
}

function collectCandidates(
  rootNode: Parser.SyntaxNode,
  query: StructuralCandidateQuery,
  _parserEvidence: TreeSitterParserEvidence,
): readonly TreeSitterReplacementCandidate[] {
  const finalKind = query.path[query.path.length - 1].kind;
  const semanticMatches: Array<{
    node: Parser.SyntaxNode;
    discoveryScope: Parser.SyntaxNode;
  }> = [];
  collectMatches(rootNode, query.path, 0, semanticMatches, query.source);

  return semanticMatches.map(({ node, discoveryScope }) => ({
    kind: finalKind,
    name: getNodeName(node),
    replacement: getLogicalReplacement(node, finalKind, query.source),
    reliabilityNode: node,
    identityRange: getIdentityRange(node, finalKind, query.source),
    identityNode: getIdentityNode(node, finalKind),
    discoveryScope,
  }));
}

function getIdentityRange(
  node: Parser.SyntaxNode,
  kind: StructuralSelectorSegment["kind"],
  source: string,
): TreeSitterReplacementCandidate["identityRange"] {
  if (
    kind !== "class" &&
    kind !== "constructor" &&
    kind !== "method" &&
    kind !== "function"
  ) {
    return undefined;
  }

  const nodeRange = treeSitterRangeToJsRange(source, node);
  const nameNode = getIdentityNode(node, kind);
  if (nameNode) {
    const nameRange = treeSitterRangeToJsRange(source, nameNode);
    return {
      startIndex: nameRange.start,
      endIndex: nameRange.end,
      coordinateSpace: "js-utf16",
    };
  }
  const body =
    node.childForFieldName("body") ?? node.childForFieldName("value");
  const identityEnd = body
    ? treeSitterRangeToJsRange(source, body).start
    : nodeRange.end;
  return {
    startIndex: nodeRange.start,
    endIndex: identityEnd,
    coordinateSpace: "js-utf16",
  };
}

function getIdentityNode(
  node: Parser.SyntaxNode,
  kind: StructuralSelectorSegment["kind"],
): Parser.SyntaxNode | undefined {
  if (
    kind !== "class" &&
    kind !== "constructor" &&
    kind !== "method" &&
    kind !== "function"
  ) {
    return undefined;
  }
  return node.childForFieldName("name") ?? undefined;
}

function getLogicalReplacement(
  semanticNode: Parser.SyntaxNode,
  kind: StructuralSelectorSegment["kind"],
  source: string,
): TreeSitterReplacement {
  const logicalNode = getLogicalReplacementNode(semanticNode, kind);
  const startNode = findLeadingDecorator(semanticNode) ?? logicalNode;
  const endNode = findDeclarationTerminator(semanticNode) ?? logicalNode;

  if (
    startNode.startIndex === logicalNode.startIndex &&
    endNode.endIndex === logicalNode.endIndex
  ) {
    return { type: "node", node: logicalNode };
  }

  return {
    type: "range",
    range: {
      startIndex: treeSitterRangeToJsRange(source, startNode).start,
      endIndex: treeSitterRangeToJsRange(source, endNode).end,
      coordinateSpace: "js-utf16",
    },
  };
}

function findLeadingDecorator(
  node: Parser.SyntaxNode,
): Parser.SyntaxNode | undefined {
  if (
    node.type !== "method_definition" &&
    node.type !== "method_signature" &&
    node.type !== "public_field_definition"
  ) {
    return undefined;
  }

  const parent = node.parent;
  if (!parent) return undefined;

  const siblings = parent.namedChildren;
  const nodeIndex = siblings.findIndex(
    (sibling) => sibling.startIndex === node.startIndex,
  );
  if (nodeIndex < 0) return undefined;

  let firstDecorator: Parser.SyntaxNode | undefined;
  for (let index = nodeIndex - 1; index >= 0; index--) {
    const sibling = siblings[index];
    if (sibling.type !== "decorator") break;
    firstDecorator = sibling;
  }
  return firstDecorator;
}

function findDeclarationTerminator(
  node: Parser.SyntaxNode,
): Parser.SyntaxNode | undefined {
  if (
    node.type !== "method_signature" &&
    node.type !== "public_field_definition"
  ) {
    return undefined;
  }

  const next = node.nextSibling;
  return next?.type === ";" ? next : undefined;
}

function collectMatches(
  currentNode: Parser.SyntaxNode,
  selectorPath: readonly StructuralSelectorSegment[],
  depth: number,
  results: Array<{
    node: Parser.SyntaxNode;
    discoveryScope: Parser.SyntaxNode;
  }>,
  source: string,
): void {
  const segment = selectorPath[depth];
  const isLast = depth === selectorPath.length - 1;
  const candidates: Parser.SyntaxNode[] = [];
  function traverse(node: Parser.SyntaxNode): void {
    for (let index = 0; index < node.namedChildCount; index++) {
      const child = node.namedChild(index);
      if (!child) continue;

      const isKindMatch = isNodeOfKind(child, segment.kind);
      const isMatch =
        isKindMatch && (!segment.name || getNodeName(child) === segment.name);

      if (isMatch) {
        candidates.push(child);
      }

      if (depth > 0 && isStructuralOwner(child)) {
        continue;
      }

      traverse(child);
    }
  }

  traverse(currentNode);

  for (const candidate of candidates) {
    if (isLast) {
      results.push({ node: candidate, discoveryScope: currentNode });
    } else {
      collectMatches(candidate, selectorPath, depth + 1, results, source);
    }
  }
}

export function createTypeScriptLanguageAdapter(
  assets: TreeSitterAssetPaths,
): TreeSitterLanguageAdapter {
  return createTreeSitterLanguageAdapter(
    {
      id: "typescript",
      extensions: TYPESCRIPT_EXTENSIONS,
      supportedKinds: STRUCTURAL_KINDS,
      grammarIdForFile,
      collectCandidates,
    },
    assets,
  );
}
