import Parser from 'web-tree-sitter';
import { StructuralKind } from './types';

export function isNodeOfKind(node: Parser.SyntaxNode, kind: StructuralKind): boolean {
  if (kind === 'class') {
    return node.type === 'class_declaration' || node.type === 'abstract_class_declaration';
  }
  if (kind === 'method') {
    return node.type === 'method_definition' || node.type === 'method_signature';
  }
  if (kind === 'constructor') {
    return (
      (node.type === 'method_definition' || node.type === 'method_signature') &&
      getNodeName(node) === 'constructor'
    );
  }
  if (kind === 'for_statement') {
    // The TypeScript grammar uses for_in_statement for both for...of and
    // for...in, while classic for loops use for_statement.
    return node.type === 'for_statement' || node.type === 'for_in_statement';
  }
  if (kind === 'while_statement') {
    return node.type === 'while_statement';
  }
  if (kind === 'switch_statement') {
    return node.type === 'switch_statement';
  }
  if (kind === 'if_statement') {
    return node.type === 'if_statement';
  }
  if (kind === 'function') {
    if (node.type === 'function_declaration' || node.type === 'generator_function_declaration') {
      return true;
    }
    if (node.type === 'variable_declarator') {
      return isFunctionValue(node);
    }
    if (node.type === 'public_field_definition') {
      return isFunctionValue(node);
    }
  }
  return false;
}

export function getNodeName(node: Parser.SyntaxNode): string | undefined {
  const nameNode = node.childForFieldName('name');
  return nameNode ? nameNode.text : undefined;
}

export function isStructuralOwner(node: Parser.SyntaxNode): boolean {
  const t = node.type;
  return (
    t === 'class_declaration' ||
    t === 'class' ||
    t === 'method_definition' ||
    t === 'function_declaration' ||
    t === 'function' ||
    t === 'function_expression' ||
    t === 'generator_function_declaration' ||
    t === 'generator_function' ||
    t === 'arrow_function' ||
    t === 'method_signature' ||
    (t === 'variable_declarator' && (isFunctionValue(node) || isClassValue(node))) ||
    (t === 'public_field_definition' && isFunctionValue(node))
  );
}

function isFunctionValue(node: Parser.SyntaxNode): boolean {
  const valueNode = node.childForFieldName('value');
  if (!valueNode) return false;
  return (
    valueNode.type === 'arrow_function' ||
    valueNode.type === 'function' ||
    valueNode.type === 'function_expression' ||
    valueNode.type === 'generator_function'
  );
}

function isClassValue(node: Parser.SyntaxNode): boolean {
  return node.childForFieldName('value')?.type === 'class';
}

export function getLogicalReplacementNode(
  semanticNode: Parser.SyntaxNode,
  kind: StructuralKind
): Parser.SyntaxNode {
  if (
    kind === 'method' ||
    kind === 'constructor' ||
    kind === 'for_statement' ||
    kind === 'while_statement' ||
    kind === 'switch_statement' ||
    kind === 'if_statement'
  ) {
    return semanticNode;
  }

  let logicalNode = semanticNode;

  if (semanticNode.type === 'variable_declarator') {
    const parent = semanticNode.parent;
    if (parent && (parent.type === 'lexical_declaration' || parent.type === 'variable_declaration')) {
      let declaratorCount = 0;
      for (let i = 0; i < parent.namedChildCount; i++) {
        if (parent.namedChild(i)?.type === 'variable_declarator') {
          declaratorCount++;
        }
      }
      if (declaratorCount > 1) {
        throw new Error('UNSUPPORTED_NODE_SHAPE');
      }
      logicalNode = parent;
    }
  }

  const p = logicalNode.parent;
  if (p && (p.type === 'export_statement' || p.type === 'export_default_declaration')) {
    logicalNode = p;
  }

  return logicalNode;
}
