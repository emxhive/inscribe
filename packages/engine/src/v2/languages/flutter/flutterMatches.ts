import Parser from 'web-tree-sitter';
import { getDartStructuralMatch } from '../dartAdapter';
import { StructuralKind } from '../types';
import {
  TreeSitterReplacement,
  TreeSitterReplacementRange,
} from '../treeSitterAdapter';
import { treeSitterRangeToJsRange } from '../../structural/treeSitterRangeToJsRange';
import {
  hasTreeSitterRecoveryAdjacentToNode,
  hasTreeSitterRecoveryInRange,
} from '../../structural/treeSitterParserEvidence';
import type { TreeSitterParserEvidence } from '../../structural/treeSitterParserEvidence';
import {
  findInvocationSelector,
  getConstructorTypeName,
  getNamedArgumentFunction,
  getNamedArgumentLabel,
  getNamedArgumentLabelNode,
} from './flutterAst';
import { FlutterSourceContext, isFlutterWidgetSuperclass } from './flutterContext';
import {
  isRequestedCallbackLabel,
  isWidgetCollectionContext,
  isWidgetValueExpression,
} from './flutterSemantics';

export interface FlutterStructuralMatch {
  kind: StructuralKind;
  name?: string;
  traversalNode: Parser.SyntaxNode;
  replacement: TreeSitterReplacement;
  identityRange?: TreeSitterReplacementRange;
  identityNode?: Parser.SyntaxNode;
  discoveryScope?: Parser.SyntaxNode;
}

export function getFlutterStructuralMatch(
  node: Parser.SyntaxNode,
  source: string,
  requestedKind: StructuralKind,
  context: FlutterSourceContext,
  parserEvidence?: TreeSitterParserEvidence,
): FlutterStructuralMatch | undefined {
  if (requestedKind === 'widget' && node.type === 'class_definition') {
    const superclass = node.childForFieldName('superclass');
    if (!superclass || !isFlutterWidgetSuperclass(superclass, context)) return undefined;

    const dartClass = getDartStructuralMatch(node, source, 'class');
    if (!dartClass) return undefined;
    return {
      kind: 'widget',
      name: dartClass.name,
      traversalNode: node,
      replacement: dartClass.replacement,
      identityRange: dartClass.identityRange,
      identityNode: dartClass.identityNode,
    };
  }

  if (requestedKind === 'builder_callback' || requestedKind === 'event_callback') {
    if (node.type !== 'named_argument') return undefined;
    const label = getNamedArgumentLabel(node);
    const callback = getNamedArgumentFunction(node);
    if (!callback) return undefined;
    const identityNode = getNamedArgumentLabelNode(node);
    const identityRange = identityNode
      ? createIdentityRange(source, identityNode, identityNode)
      : createIdentityPrefixRange(source, node, callback);
    const identityUncertain = parserEvidence && (
      hasTreeSitterRecoveryInRange(
        source,
        parserEvidence,
        {
          start: identityRange.startIndex,
          end: identityRange.endIndex,
        },
      ) ||
      (identityNode !== undefined && hasTreeSitterRecoveryAdjacentToNode(parserEvidence, identityNode))
    );
    if ((!label || !isRequestedCallbackLabel(label, requestedKind)) && !identityUncertain) {
      return undefined;
    }
    return {
      kind: requestedKind,
      name: label,
      traversalNode: callback,
      replacement: { type: 'node', node: callback },
      identityRange,
      identityNode,
    };
  }

  if (requestedKind === 'collection_if' && node.type === 'if_element') {
    if (!isWidgetCollectionContext(node)) return undefined;
    return { kind: requestedKind, traversalNode: node, replacement: { type: 'node', node } };
  }

  if (requestedKind === 'collection_for' && node.type === 'for_element') {
    if (!isWidgetCollectionContext(node)) return undefined;
    return { kind: requestedKind, traversalNode: node, replacement: { type: 'node', node } };
  }

  if (requestedKind === 'builder_branch' && node.type === 'if_statement') {
    if (!findOwningBuilderCallback(node)) return undefined;
    return { kind: requestedKind, traversalNode: node, replacement: { type: 'node', node } };
  }

  if (requestedKind === 'widget_subtree') {
    return getWidgetSubtreeMatch(node, source);
  }

  return undefined;
}

function getWidgetSubtreeMatch(
  node: Parser.SyntaxNode,
  source: string,
): FlutterStructuralMatch | undefined {
  if (node.type === 'const_object_expression') {
    const name = getConstructorTypeName(node);
    if (!isWidgetConstructorName(name) || !isWidgetValueExpression(node)) return undefined;
    const identityNode = node.namedChildren.find((child) => child.type === 'type_identifier');
    return {
      kind: 'widget_subtree',
      name,
      traversalNode: node,
      replacement: { type: 'node', node },
      identityRange: identityNode
        ? createIdentityRange(source, identityNode, identityNode)
        : createIdentityRange(source, node, node),
      identityNode,
    };
  }

  if (node.type !== 'identifier' || node.parent?.type === 'const_object_expression') {
    return undefined;
  }

  const name = node.text;
  if (!isWidgetConstructorName(name)) return undefined;
  const invocation = findInvocationSelector(node);
  if (!invocation || !isWidgetValueExpression(node)) return undefined;

  const start = treeSitterRangeToJsRange(source, node).start;
  const end = treeSitterRangeToJsRange(source, invocation).end;
  return {
    kind: 'widget_subtree',
    name,
    traversalNode: invocation,
    identityRange: createIdentityRange(source, node, node),
    identityNode: node,
    replacement: {
      type: 'range',
      range: { startIndex: start, endIndex: end, coordinateSpace: 'js-utf16' },
    },
  };
}

function createIdentityRange(
  source: string,
  startNode: Parser.SyntaxNode,
  endNode: Parser.SyntaxNode,
): TreeSitterReplacementRange {
  return {
    startIndex: treeSitterRangeToJsRange(source, startNode).start,
    endIndex: treeSitterRangeToJsRange(source, endNode).end,
    coordinateSpace: 'js-utf16',
  };
}

function createIdentityPrefixRange(
  source: string,
  startNode: Parser.SyntaxNode,
  endNode: Parser.SyntaxNode,
): TreeSitterReplacementRange {
  return {
    startIndex: treeSitterRangeToJsRange(source, startNode).start,
    endIndex: treeSitterRangeToJsRange(source, endNode).start,
    coordinateSpace: 'js-utf16',
  };
}

function isWidgetConstructorName(name: string | undefined): name is string {
  return name !== undefined && /^[A-Z][A-Za-z0-9_$]*$/.test(name);
}

function findOwningBuilderCallback(node: Parser.SyntaxNode): Parser.SyntaxNode | undefined {
  let current = node.parent;
  while (current) {
    if (current.type === 'function_expression') {
      const owner = current.parent;
      if (owner?.type === 'named_argument') {
        const label = getNamedArgumentLabel(owner);
        if (label && isRequestedCallbackLabel(label, 'builder_callback')) return current;
      }
      return undefined;
    }
    current = current.parent;
  }
  return undefined;
}
