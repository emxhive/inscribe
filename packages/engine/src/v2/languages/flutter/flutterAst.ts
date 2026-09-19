import Parser from 'web-tree-sitter';

function firstNamedChildOfType(
  node: Parser.SyntaxNode,
  type: string,
): Parser.SyntaxNode | undefined {
  for (let index = 0; index < node.namedChildCount; index++) {
    const child = node.namedChild(index);
    if (child?.type === type) return child;
  }
  return undefined;
}

function fieldOrNamedChild(
  node: Parser.SyntaxNode,
  fieldName: string,
  type: string,
): Parser.SyntaxNode | undefined {
  const field = node.childForFieldName(fieldName);
  return field?.type === type ? field : firstNamedChildOfType(node, type);
}

export function getFunctionExpressionBody(
  node: Parser.SyntaxNode,
): Parser.SyntaxNode | undefined {
  return fieldOrNamedChild(node, 'body', 'function_expression_body');
}

export function getNamedArgumentLabel(
  node: Parser.SyntaxNode,
): string | undefined {
  if (node.type !== 'named_argument') return undefined;

  const label = fieldOrNamedChild(node, 'label', 'label');
  if (!label) return undefined;

  const identifier =
    label.childForFieldName('name') ?? firstNamedChildOfType(label, 'identifier');
  return identifier?.type === 'identifier' ? identifier.text : undefined;
}

export function getNamedArgumentFunction(
  node: Parser.SyntaxNode,
): Parser.SyntaxNode | undefined {
  if (node.type !== 'named_argument') return undefined;
  return firstNamedChildOfType(node, 'function_expression');
}

export function findInvocationSelector(
  node: Parser.SyntaxNode,
): Parser.SyntaxNode | undefined {
  const parent = node.parent;
  if (!parent) return undefined;

  for (let index = 0; index < parent.namedChildCount; index++) {
    const child = parent.namedChild(index);
    if (!child || child.startIndex <= node.startIndex || child.type !== 'selector') continue;
    if (isInvocationSelector(child)) return child;
  }

  return undefined;
}

export function isInvocationSelector(node: Parser.SyntaxNode): boolean {
  if (node.type !== 'selector') return false;
  const argumentPart = fieldOrNamedChild(node, 'argument_part', 'argument_part');
  if (!argumentPart) return false;
  return fieldOrNamedChild(argumentPart, 'arguments', 'arguments') !== undefined;
}

export function getConstructorTypeName(
  node: Parser.SyntaxNode,
): string | undefined {
  if (node.type !== 'const_object_expression') return undefined;

  const type = firstNamedChildOfType(node, 'type_identifier');
  return type?.text;
}

export function getSuperclassName(
  node: Parser.SyntaxNode,
): string | undefined {
  const superclass = node.type === 'superclass'
    ? node
    : node.childForFieldName('superclass');
  if (!superclass) return undefined;

  return getTypeName(superclass);
}

export function getDeclaredName(
  node: Parser.SyntaxNode,
): string | undefined {
  const directName = node.childForFieldName('name');
  if (directName?.type === 'identifier') return directName.text;

  for (let index = 0; index < node.namedChildCount; index++) {
    const child = node.namedChild(index);
    if (!child) continue;
    const nestedName = child.childForFieldName('name');
    if (nestedName?.type === 'identifier') return nestedName.text;
  }

  return undefined;
}

export function getFunctionReturnTypeName(
  node: Parser.SyntaxNode,
): string | undefined {
  const signature = node.type === 'function_signature'
    ? node
    : firstNamedChildOfType(node, 'function_signature');
  if (!signature) return undefined;

  const name = signature.childForFieldName('name');
  for (let index = 0; index < signature.namedChildCount; index++) {
    const child = signature.namedChild(index);
    if (!child || (name && child.startIndex >= name.startIndex)) break;
    const typeName = getTypeName(child);
    if (typeName) return typeName;
  }

  return undefined;
}

export function getTypeName(node: Parser.SyntaxNode): string | undefined {
  if (node.type === 'type_identifier') return node.text;

  for (let index = 0; index < node.namedChildCount; index++) {
    const child = node.namedChild(index);
    if (!child) continue;
    const typeName = getTypeName(child);
    if (typeName) return typeName;
  }

  return undefined;
}

export function getTypeArgumentNames(
  node: Parser.SyntaxNode,
): readonly string[] {
  const typeArguments = node.type === 'type_arguments'
    ? node
    : fieldOrNamedChild(node, 'type_arguments', 'type_arguments');
  if (!typeArguments) return [];

  const names: string[] = [];
  for (let index = 0; index < typeArguments.namedChildCount; index++) {
    const child = typeArguments.namedChild(index);
    const name = child ? getTypeName(child) : undefined;
    if (name) names.push(name);
  }
  return names;
}

export function getListElementTypeName(
  node: Parser.SyntaxNode,
): string | undefined {
  if (node.type !== 'list_literal') return undefined;
  return getTypeArgumentNames(node)[0];
}

export function getDeclaredTypeNames(
  node: Parser.SyntaxNode,
): readonly string[] {
  if (node.type !== 'initialized_variable_definition') return [];

  const variableName = node.childForFieldName('name');
  const typeNames: string[] = [];
  for (let index = 0; index < node.namedChildCount; index++) {
    const child = node.namedChild(index);
    if (!child || child.type === 'identifier') continue;
    if (variableName && child.startIndex >= variableName.startIndex) break;
    const typeName = getTypeName(child);
    if (typeName) typeNames.push(typeName);
  }
  return typeNames;
}

export function findPrecedingNamedSibling(
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

export function isDirectExpressionInBody(
  startNode: Parser.SyntaxNode,
  body: Parser.SyntaxNode,
): boolean {
  for (let index = 0; index < body.namedChildCount; index++) {
    if (body.namedChild(index)?.startIndex === startNode.startIndex) {
      return true;
    }
  }
  return false;
}

export function isFunctionBoundary(node: Parser.SyntaxNode): boolean {
  return (
    node.type === 'function_expression' ||
    node.type === 'lambda_expression' ||
    node.type === 'local_function_declaration'
  );
}

export function isSameSyntaxNode(
  left: Parser.SyntaxNode,
  right: Parser.SyntaxNode,
): boolean {
  return (
    left.type === right.type &&
    left.startIndex === right.startIndex &&
    left.endIndex === right.endIndex
  );
}

export function findNearestFunctionBoundary(
  node: Parser.SyntaxNode,
): Parser.SyntaxNode | undefined {
  let current = node.parent;
  while (current) {
    if (isFunctionBoundary(current)) return current;
    current = current.parent;
  }
  return undefined;
}

export function findEnclosingFunctionBody(
  node: Parser.SyntaxNode,
): Parser.SyntaxNode | undefined {
  let current = node.parent;
  while (current) {
    if (current.type === 'function_body') return current;
    if (isFunctionBoundary(current)) return undefined;
    current = current.parent;
  }
  return undefined;
}
