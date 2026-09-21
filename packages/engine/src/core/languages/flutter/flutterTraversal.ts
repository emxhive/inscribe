import Parser from "web-tree-sitter";
import {
  DartStructuralMatch,
  getDartStructuralMatch,
  isDartStructuralOwner,
} from "../dartAdapter";
import { StructuralCandidateQuery, StructuralSelectorSegment } from "../types";
import { FlutterSourceContext } from "./flutterContext";
import {
  FlutterStructuralMatch,
  getFlutterStructuralMatch,
} from "./flutterMatches";
type StructuralMatch = FlutterStructuralMatch | DartStructuralMatch;

export function collectFlutterMatches(
  currentNode: Parser.SyntaxNode,
  selectorPath: readonly StructuralSelectorSegment[],
  depth: number,
  results: FlutterStructuralMatch[],
  query: StructuralCandidateQuery,
  context: FlutterSourceContext,
): void {
  const segment = selectorPath[depth];
  const isLast = depth === selectorPath.length - 1;
  const candidates: StructuralMatch[] = [];

  function traverse(node: Parser.SyntaxNode): void {
    for (let index = 0; index < node.namedChildCount; index++) {
      const child = node.namedChild(index);
      if (!child) continue;

      const structuralMatch = getStructuralMatch(
        child,
        query,
        segment.kind,
        context,
      );
      const isMatch =
        structuralMatch?.kind === segment.kind &&
        (!segment.name || structuralMatch.name === segment.name);

      if (isMatch) candidates.push(structuralMatch);

      if (
        depth > 0 &&
        (isDartStructuralOwner(child) || isOwnedFunctionBody(child)) &&
        structuralMatch?.kind !== segment.kind
      ) {
        continue;
      }

      traverse(child);
    }
  }

  traverse(currentNode);

  for (const candidate of candidates) {
    if (isLast) {
      results.push({
        ...(candidate as FlutterStructuralMatch),
        discoveryScope: currentNode,
      });
    } else {
      collectFlutterMatches(
        candidate.traversalNode,
        selectorPath,
        depth + 1,
        results,
        query,
        context,
      );
    }
  }
}

function getStructuralMatch(
  node: Parser.SyntaxNode,
  query: StructuralCandidateQuery,
  requestedKind: StructuralSelectorSegment["kind"],
  context: FlutterSourceContext,
): StructuralMatch | undefined {
  if (
    requestedKind === "widget" ||
    requestedKind === "widget_subtree" ||
    requestedKind === "builder_callback" ||
    requestedKind === "event_callback" ||
    requestedKind === "collection_if" ||
    requestedKind === "collection_for" ||
    requestedKind === "builder_branch"
  ) {
    return getFlutterStructuralMatch(
      node,
      query.source,
      requestedKind,
      context,
    );
  }
  return getDartStructuralMatch(node, query.source, requestedKind);
}

function isOwnedFunctionBody(node: Parser.SyntaxNode): boolean {
  if (node.type !== "function_body") return false;
  const preceding = getPrecedingNamedSibling(node);
  return preceding ? isDartStructuralOwner(preceding) : false;
}

function getPrecedingNamedSibling(
  node: Parser.SyntaxNode,
): Parser.SyntaxNode | undefined {
  const parent = node.parent;
  if (!parent) return undefined;

  for (let index = 1; index < parent.namedChildCount; index++) {
    if (parent.namedChild(index)?.startIndex === node.startIndex) {
      return parent.namedChild(index - 1) ?? undefined;
    }
  }
  return undefined;
}
