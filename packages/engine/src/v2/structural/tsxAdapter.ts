import Parser from 'web-tree-sitter';
import { StructuralKind } from './types';

export function isNodeOfKind(node: Parser.SyntaxNode, kind: StructuralKind): boolean {
  if (kind === 'class') {
    return node.type === 'class_declaration';
  }
  if (kind === 'method') {
    return node.type === 'method_definition';
  }
  if (kind === 'if_statement') {
    return node.type === 'if_statement';
  }
  if (kind === 'function') {
    if (node.type === 'function_declaration' || node.type === 'generator_function_declaration') {
      return true;
    }
    if (node.type === 'variable_declarator') {
      const valueNode = node.childForFieldName('value');
      if (
        valueNode &&
        (valueNode.type === 'arrow_function' ||
          valueNode.type === 'function' ||
          valueNode.type === 'function_expression' ||
          valueNode.type === 'generator_function')
      ) {
        return true;
      }
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
    (t === 'variable_declarator' && isArrowOrFunctionDeclarator(node))
  );
}

function isArrowOrFunctionDeclarator(node: Parser.SyntaxNode): boolean {
  const valueNode = node.childForFieldName('value');
  if (!valueNode) return false;
  return (
    valueNode.type === 'arrow_function' ||
    valueNode.type === 'function' ||
    valueNode.type === 'function_expression' ||
    valueNode.type === 'generator_function' ||
    valueNode.type === 'class'
  );
}

export function getLogicalReplacementNode(
  semanticNode: Parser.SyntaxNode,
  kind: StructuralKind
): Parser.SyntaxNode {
  if (kind === 'method' || kind === 'if_statement') {
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
