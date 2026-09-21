import Parser from "web-tree-sitter";
import type {
  StructuralParserDiagnostic,
  StructuralParserFailure,
} from "@inscribe/shared";
import { treeSitterRangeToJsRange } from "./treeSitterRangeToJsRange";

export interface TreeSitterParserEvidence {
  diagnostics: readonly StructuralParserDiagnostic[];
  totalDiagnostics: number;
  /** Live Tree-sitter recovery nodes used only while the parsed tree exists. */
  recoveryNodes: readonly Parser.SyntaxNode[];
}

export interface TreeSitterJsRange {
  start: number;
  end: number;
}

const MAX_DIAGNOSTIC_CONTEXT_LENGTH = 240;
const MAX_DIAGNOSTICS_IN_FAILURE = 20;
const DIAGNOSTIC_CONTEXT_RADIUS = 96;

/** Extracts parser facts without deciding whether any structural candidate is safe. */
export function collectTreeSitterParserEvidence(
  rootNode: Parser.SyntaxNode,
  source: string,
): TreeSitterParserEvidence {
  const diagnostics: StructuralParserDiagnostic[] = [];
  const recoveryNodes: Parser.SyntaxNode[] = [];

  function visit(node: Parser.SyntaxNode): void {
    const isError = node.type === "ERROR";
    const isMissing = node.isMissing();
    if (isError || isMissing) {
      recoveryNodes.push(node);
      const range = treeSitterRangeToJsRange(source, node);
      const start = pointForOffset(source, range.start);
      const end = pointForOffset(source, range.end);
      diagnostics.push({
        condition: isMissing ? "MISSING_NODE" : "ERROR_NODE",
        nodeType: node.type,
        startIndex: range.start,
        endIndex: range.end,
        startLine: start.line,
        startColumn: start.column,
        endLine: end.line,
        endColumn: end.column,
        context: createDiagnosticContext(source, range.start, range.end),
      });
      // Descendants would duplicate the same recovered region.
      return;
    }

    for (const child of node.children) visit(child);
  }

  visit(rootNode);
  return {
    diagnostics,
    totalDiagnostics: diagnostics.length,
    recoveryNodes,
  };
}

export function createTreeSitterParserFailure(
  adapterId: string,
  grammarId: string,
  diagnostics: readonly StructuralParserDiagnostic[],
  totalDiagnostics: number,
): StructuralParserFailure {
  const limitedDiagnostics = diagnostics.slice(0, MAX_DIAGNOSTICS_IN_FAILURE);
  return {
    parser: "tree-sitter",
    adapterId,
    grammarId,
    diagnostics: [...limitedDiagnostics],
    totalDiagnostics,
    diagnosticsTruncated:
      diagnostics.length > limitedDiagnostics.length ||
      totalDiagnostics > diagnostics.length,
  };
}

export function createTreeSitterRecoveryDiagnostic(
  source: string,
  node: Parser.SyntaxNode,
): StructuralParserDiagnostic {
  const range = treeSitterRangeToJsRange(source, node);
  const start = pointForOffset(source, range.start);
  const end = pointForOffset(source, range.end);
  return {
    condition: node.isMissing() ? "MISSING_NODE" : "ERROR_NODE",
    nodeType: node.type,
    startIndex: range.start,
    endIndex: range.end,
    startLine: start.line,
    startColumn: start.column,
    endLine: end.line,
    endColumn: end.column,
    context: createDiagnosticContext(source, range.start, range.end),
  };
}

function pointForOffset(
  source: string,
  offset: number,
): { line: number; column: number } {
  const safeOffset = Math.max(0, Math.min(source.length, offset));
  const before = source.slice(0, safeOffset);
  const lastNewline = before.lastIndexOf("\n");
  return {
    line: before.split("\n").length,
    column: safeOffset - (lastNewline + 1),
  };
}

function createDiagnosticContext(
  source: string,
  start: number,
  end: number,
): string {
  const contextStart = Math.max(0, start - DIAGNOSTIC_CONTEXT_RADIUS);
  const contextEnd = Math.min(
    source.length,
    Math.max(end, start) + DIAGNOSTIC_CONTEXT_RADIUS,
  );
  const context = source.slice(contextStart, contextEnd);
  if (context.length <= MAX_DIAGNOSTIC_CONTEXT_LENGTH) return context;

  const headLength = Math.floor((MAX_DIAGNOSTIC_CONTEXT_LENGTH - 1) / 2);
  const tailLength = MAX_DIAGNOSTIC_CONTEXT_LENGTH - headLength - 1;
  return `${context.slice(0, headLength)}…${context.slice(-tailLength)}`;
}
