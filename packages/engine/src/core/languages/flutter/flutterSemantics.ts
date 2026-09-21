import Parser from 'web-tree-sitter';
import {
  findEnclosingFunctionBody,
  findNearestFunctionBoundary,
  getDeclaredName,
  getDeclaredTypeNames,
  getFunctionExpressionBody,
  getFunctionReturnTypeName,
  getListElementTypeName,
  getNamedArgumentLabel,
  isDirectExpressionInBody,
  isFunctionBoundary,
  isSameSyntaxNode,
  findPrecedingNamedSibling,
} from './flutterAst';

const WIDGET_ARGUMENT_LABELS = new Set([
  'child',
  'children',
  'body',
  'appBar',
  'title',
  'actions',
  'leading',
  'trailing',
  'icon',
  'drawer',
  'endDrawer',
  'bottomNavigationBar',
  'floatingActionButton',
  'bottomSheet',
  'header',
  'footer',
  'content',
  'empty',
  'placeholder',
  'prefixIcon',
  'suffixIcon',
]);

/**
 * A small, source-evidence based Flutter gate. The adapter remains usable for
 * ordinary Dart targeting, but Flutter selectors only become meaningful when
 * the file contains Flutter evidence of its own.
 */
export function isFlutterSource(source: string): boolean {
  return (
    /\bimport\s+['"]package:flutter\//.test(source) ||
    /\b(?:extends|implements)\s+(?:State\s*<|Widget|StatelessWidget|StatefulWidget|InheritedWidget|ProxyWidget|ParentDataWidget|RenderObjectWidget|LeafRenderObjectWidget|SingleChildRenderObjectWidget|MultiChildRenderObjectWidget)\b/.test(source)
  );
}

export function isWidgetValueExpression(
  node: Parser.SyntaxNode,
): boolean {
  const boundary = findNearestFunctionBoundary(node);
  if (boundary && !isBuilderReturnContext(node, boundary)) return false;

  if (isDirectNamedArgumentValue(node)) return true;
  if (isDirectReturnExpression(node)) return true;
  if (isDirectWidgetCollectionElement(node)) return true;

  if (boundary?.type === 'function_expression' && isBuilderReturnContext(node, boundary)) {
    const body = getFunctionExpressionBody(boundary);
    if (body && isDirectExpressionInBody(node, body)) return true;
  }

  return isDirectBuildExpression(node);
}

export function isWidgetArgumentLabel(label: string): boolean {
  return WIDGET_ARGUMENT_LABELS.has(label);
}

export function isRequestedCallbackLabel(
  label: string,
  kind: 'builder_callback' | 'event_callback',
): boolean {
  if (kind === 'builder_callback') {
    return /^(?:builder|[A-Za-z_$]*Builder)$/.test(label);
  }
  return /^on[A-Z]/.test(label);
}

export function isWidgetCollectionContext(node: Parser.SyntaxNode): boolean {
  let current = node.parent;
  while (current) {
    if (isFunctionBoundary(current)) return false;
    if (current.type === 'list_literal') return isWidgetListContext(current);
    if (current.type !== 'if_element' && current.type !== 'for_element') return false;
    current = current.parent;
  }
  return false;
}

function isWidgetListContext(node: Parser.SyntaxNode): boolean {
  const elementType = getListElementTypeName(node);
  if (elementType === 'Widget') return true;

  const owner = node.parent;
  if (owner?.type === 'named_argument') {
    const label = getNamedArgumentLabel(owner);
    return label !== undefined && isWidgetArgumentLabel(label);
  }

  return owner?.type === 'initialized_variable_definition' && isWidgetCollectionVariable(owner);
}

function isWidgetCollectionVariable(node: Parser.SyntaxNode): boolean {
  const typeNames = getDeclaredTypeNames(node);
  return (
    typeNames.some((name) => name === 'List' || name === 'Iterable' || name === 'Set') &&
    typeNames.includes('Widget')
  );
}

function isDirectWidgetCollectionElement(node: Parser.SyntaxNode): boolean {
  const parent = node.parent;
  if (!parent) return false;

  if (parent.type === 'list_literal') {
    return isWidgetListContext(parent);
  }

  if (parent.type === 'if_element') {
    return (
      isDirectCollectionBranchExpression(node, parent, 'consequence') ||
      isDirectCollectionBranchExpression(node, parent, 'alternative')
    ) && isWidgetCollectionContext(parent);
  }

  if (parent.type === 'for_element') {
    return isDirectCollectionBranchExpression(node, parent, 'body') && isWidgetCollectionContext(parent);
  }

  return false;
}

function isDirectCollectionBranchExpression(
  node: Parser.SyntaxNode,
  collectionNode: Parser.SyntaxNode,
  fieldName: string,
): boolean {
  return collectionNode.childForFieldName(fieldName)?.startIndex === node.startIndex;
}

function isDirectNamedArgumentValue(node: Parser.SyntaxNode): boolean {
  const parent = node.parent;
  if (parent?.type !== 'named_argument') return false;

  const label = getNamedArgumentLabel(parent);
  if (!label || !isWidgetArgumentLabel(label)) return false;

  for (let index = 1; index < parent.namedChildCount; index++) {
    if (parent.namedChild(index)?.startIndex === node.startIndex) return true;
  }
  return false;
}

function isDirectReturnExpression(
  node: Parser.SyntaxNode,
): boolean {
  if (node.parent?.type !== 'return_statement') return false;

  const boundary = findNearestFunctionBoundary(node);
  return boundary ? isBuilderReturnContext(node, boundary) : isDirectBuildExpression(node);
}

function isDirectBuildExpression(
  node: Parser.SyntaxNode,
): boolean {
  const body = findEnclosingFunctionBody(node);
  if (!body || !isWidgetBuildBody(body)) return false;

  if (node.parent?.type === 'return_statement') return true;
  return isDirectExpressionInBody(node, body);
}

function isWidgetBuildBody(body: Parser.SyntaxNode): boolean {
  const owner = findPrecedingNamedSibling(body);
  if (owner?.type !== 'method_signature') return false;
  return getFunctionReturnTypeName(owner) === 'Widget' && getDeclaredName(owner) === 'build';
}

function isBuilderReturnContext(
  startNode: Parser.SyntaxNode,
  boundary: Parser.SyntaxNode,
): boolean {
  if (boundary.type !== 'function_expression' || !isBuilderCallback(boundary)) {
    return false;
  }

  let current: Parser.SyntaxNode | null = startNode;
  while (current && !isSameSyntaxNode(current, boundary)) {
    if (isFunctionBoundary(current)) return false;
    if (current.type === 'return_statement') return true;
    current = current.parent;
  }

  const body = getFunctionExpressionBody(boundary);
  return body ? isDirectExpressionInBody(startNode, body) : false;
}

function isBuilderCallback(node: Parser.SyntaxNode): boolean {
  if (node.type !== 'function_expression') return false;
  const owner = node.parent;
  if (owner?.type !== 'named_argument') return false;
  const label = getNamedArgumentLabel(owner);
  return label !== undefined && isRequestedCallbackLabel(label, 'builder_callback');
}
