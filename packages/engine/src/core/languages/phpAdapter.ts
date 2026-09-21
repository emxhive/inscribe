import Parser from "web-tree-sitter";
import type { TreeSitterParserEvidence } from "../structural/treeSitterParserEvidence";
import { TreeSitterAssetPaths } from "../structural/treeSitterRuntime";
import {
  StructuralCandidateQuery,
  StructuralKind,
  StructuralSelectorSegment,
  TreeSitterLanguageAdapter,
  STRUCTURAL_KINDS,
} from "./types";
import {
  createTreeSitterLanguageAdapter,
  TreeSitterReplacementCandidate,
} from "./treeSitterAdapter";

const PHP_EXTENSIONS = [".php"] as const;

const PHP_CLASS_LIKE_TYPES = new Set([
  "class_declaration",
  "interface_declaration",
  "trait_declaration",
  "enum_declaration",
]);

const PHP_ANONYMOUS_OWNER_TYPES = new Set([
  "anonymous_function_creation_expression",
  "arrow_function",
  "anonymous_class",
]);

const PHP_EXECUTABLE_OWNER_TYPES = new Set([
  "method_declaration",
  "function_definition",
  ...PHP_ANONYMOUS_OWNER_TYPES,
]);

function grammarIdForFile(_filePath: string): string {
  return "php";
}

function collectCandidates(
  rootNode: Parser.SyntaxNode,
  query: StructuralCandidateQuery,
  _parserEvidence: TreeSitterParserEvidence,
): readonly TreeSitterReplacementCandidate[] {
  const finalKind = query.path[query.path.length - 1].kind;
  const matches: Array<{
    node: Parser.SyntaxNode;
    discoveryScope: Parser.SyntaxNode;
  }> = [];

  collectMatches(rootNode, query.path, 0, matches);

  return matches.map(({ node, discoveryScope }) => ({
    kind: finalKind,
    name: getCandidateName(node, finalKind),
    replacement: { type: "node", node },
    identityNode: getIdentityNode(node, finalKind),
    reliabilityNode: node,
    discoveryScope,
  }));
}

function collectMatches(
  currentNode: Parser.SyntaxNode,
  selectorPath: readonly StructuralSelectorSegment[],
  depth: number,
  results: Array<{
    node: Parser.SyntaxNode;
    discoveryScope: Parser.SyntaxNode;
  }>,
): void {
  const segment = selectorPath[depth];
  const isLast = depth === selectorPath.length - 1;
  const candidates: Parser.SyntaxNode[] = [];

  function traverse(node: Parser.SyntaxNode): void {
    for (let index = 0; index < node.namedChildCount; index++) {
      const child = node.namedChild(index);
      if (!child) continue;

      const isMatch = isRequestedNode(child, segment.kind);
      if (isMatch && (!segment.name || getCandidateName(child, segment.kind) === segment.name)) {
        candidates.push(child);
      }

      // Matching a statement is not an ownership boundary. Keep walking its
      // descendants so nested same-kind candidates remain visible to the
      // shared ambiguity/qualification logic. Declaration matches become the
      // next explicit path scope below and must not be walked as unowned
      // descendants.
      if (isMatch && isStatementKind(segment.kind)) {
        traverse(child);
        continue;
      }
      if (isMatch) continue;

      if (!shouldTraverseOwner(child, segment.kind, depth)) continue;
      traverse(child);
    }
  }

  traverse(currentNode);

  for (const candidate of candidates) {
    if (isLast) {
      results.push({ node: candidate, discoveryScope: currentNode });
    } else {
      collectMatches(candidate, selectorPath, depth + 1, results);
    }
  }
}

function isRequestedNode(
  node: Parser.SyntaxNode,
  requestedKind: StructuralKind,
): boolean {
  switch (requestedKind) {
    case "class":
      return node.type === "class_declaration";
    case "function":
      return node.type === "function_definition";
    case "method":
      return node.type === "method_declaration";
    case "constructor":
      return node.type === "method_declaration" && getNodeName(node) === "__construct";
    case "if_statement":
      return node.type === "if_statement";
    case "for_statement":
      return node.type === "for_statement";
    case "while_statement":
      return node.type === "while_statement";
    case "switch_statement":
      return node.type === "switch_statement";
    default:
      return false;
  }
}

function getCandidateName(
  node: Parser.SyntaxNode,
  requestedKind: StructuralKind,
): string | undefined {
  if (
    requestedKind !== "class" &&
    requestedKind !== "function" &&
    requestedKind !== "method" &&
    requestedKind !== "constructor"
  ) {
    return undefined;
  }
  return getNodeName(node);
}

function getIdentityNode(
  node: Parser.SyntaxNode,
  requestedKind: StructuralKind,
): Parser.SyntaxNode | undefined {
  if (
    requestedKind !== "class" &&
    requestedKind !== "function" &&
    requestedKind !== "method" &&
    requestedKind !== "constructor"
  ) {
    return undefined;
  }
  return node.childForFieldName("name") ?? undefined;
}

function getNodeName(node: Parser.SyntaxNode): string | undefined {
  return node.childForFieldName("name")?.text;
}

/**
 * PHP's declaration nodes are already logical replacement nodes. In
 * particular, method_declaration includes attributes, modifiers, and either
 * its body or declaration-only semicolon in the installed grammar.
 */
function shouldTraverseOwner(
  node: Parser.SyntaxNode,
  requestedKind: StructuralKind,
  depth: number,
): boolean {
  if (PHP_ANONYMOUS_OWNER_TYPES.has(node.type)) return false;

  if (PHP_CLASS_LIKE_TYPES.has(node.type)) {
    // An unscoped method/statement selector may search named class-like
    // declarations, but class:A > method must stay within A and not enter a
    // nested named class.
    return depth === 0 && isMethodOrStatementKind(requestedKind);
  }

  if (PHP_EXECUTABLE_OWNER_TYPES.has(node.type)) {
    // Direct statement selectors preserve the existing language-neutral
    // behavior of searching named executable bodies. Once a named owner is
    // selected, its descendants are reached through the explicit path and
    // nested executable owners are barriers.
    return depth === 0 && isStatementKind(requestedKind) && !hasExecutableOwnerAncestor(node);
  }

  return true;
}

function isMethodOrStatementKind(kind: StructuralKind): boolean {
  return kind === "method" || kind === "constructor" || isStatementKind(kind);
}

function isStatementKind(kind: StructuralKind): boolean {
  return (
    kind === "if_statement" ||
    kind === "for_statement" ||
    kind === "while_statement" ||
    kind === "switch_statement"
  );
}

function hasExecutableOwnerAncestor(node: Parser.SyntaxNode): boolean {
  let parent = node.parent;
  while (parent) {
    if (PHP_EXECUTABLE_OWNER_TYPES.has(parent.type)) return true;
    parent = parent.parent;
  }
  return false;
}

export function createPhpLanguageAdapter(
  assets: TreeSitterAssetPaths,
): TreeSitterLanguageAdapter {
  return createTreeSitterLanguageAdapter(
    {
      id: "php",
      extensions: PHP_EXTENSIONS,
      supportedKinds: STRUCTURAL_KINDS,
      grammarIdForFile,
      collectCandidates,
    },
    assets,
  );
}
