import { parse } from '@babel/parser';

function parseAst(content: string) {
  return parse(content, { sourceType: 'unambiguous', plugins: ['typescript', 'jsx'] });
}

interface SymbolMatch {
  name: string;
  ownerName: string | null;
  start: number;
  end: number;
  description: string;
}

export function resolveSymbolDeclarationRange(content: string, name: string): { start: number; end: number; description: string } {
  const ast = parseAst(content) as any;
  const matches: SymbolMatch[] = [];
  const [ownerSelector, symbolSelector] = splitSymbolSelector(name);

  function rangeFor(owner: any, description: string): { start: number; end: number; description: string } {
    return { start: owner.start, end: owner.end, description: `${description} at line ${owner.loc.start.line}` };
  }

  function pushMatch(symbolName: string, ownerName: string | null, owner: any, description: string) {
    const range = rangeFor(owner, description);
    matches.push({
      name: symbolName,
      ownerName,
      ...range,
    });
  }

  function fnLike(node: any): boolean {
    if (!node) return false;
    if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') return true;
    if (node.type === 'CallExpression') {
      const callee = node.callee;
      const direct = callee?.type === 'Identifier' && (callee.name === 'memo' || callee.name === 'forwardRef');
      const reactMemo = callee?.type === 'MemberExpression' && callee.object?.type === 'Identifier' && callee.object.name === 'React' && callee.property?.type === 'Identifier' && callee.property.name === 'memo';
      return (direct || reactMemo) && node.arguments?.some((arg: any) => arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression');
    }
    return false;
  }

  function getClassName(node: any): string | null {
    if (node?.type === 'ClassDeclaration' && node.id?.type === 'Identifier') {
      return node.id.name;
    }
    return null;
  }

  function getMethodName(key: any): string | null {
    if (!key) return null;
    if (key.type === 'Identifier') return key.name;
    if (key.type === 'PrivateName' && key.id?.type === 'Identifier') return key.id.name;
    if (key.type === 'StringLiteral' || key.type === 'NumericLiteral') return String(key.value);
    return null;
  }

  function collectClassMethods(classNode: any) {
    const className = getClassName(classNode);
    if (!className) return;

    for (const member of classNode.body?.body ?? []) {
      if (member.type !== 'ClassMethod' && member.type !== 'ClassPrivateMethod') continue;
      const methodName = getMethodName(member.key);
      if (!methodName) continue;
      pushMatch(methodName, className, member, `${className}.${methodName} ${member.type}`);
    }
  }

  for (const stmt of ast.program.body as any[]) {
    const declaration = stmt.type === 'ExportNamedDeclaration' || stmt.type === 'ExportDefaultDeclaration'
      ? stmt.declaration
      : stmt;
    const owner = stmt.type === 'ExportNamedDeclaration' || stmt.type === 'ExportDefaultDeclaration'
      ? stmt
      : declaration;

    if (declaration?.type === 'FunctionDeclaration' && declaration.id?.name) {
      pushMatch(declaration.id.name, null, owner, stmt.type === declaration.type ? 'FunctionDeclaration' : `${stmt.type} FunctionDeclaration`);
    }

    if (declaration?.type === 'ClassDeclaration' && declaration.id?.name) {
      pushMatch(declaration.id.name, null, owner, stmt.type === declaration.type ? 'ClassDeclaration' : `${stmt.type} ClassDeclaration`);
    }

    if (declaration?.type === 'ClassDeclaration') {
      collectClassMethods(declaration);
    }

    if (declaration?.type === 'TSInterfaceDeclaration' && declaration.id?.name) {
      pushMatch(declaration.id.name, null, owner, stmt.type === declaration.type ? 'TSInterfaceDeclaration' : `${stmt.type} TSInterfaceDeclaration`);
    }

    if (declaration?.type === 'TSEnumDeclaration' && declaration.id?.name) {
      pushMatch(declaration.id.name, null, owner, stmt.type === declaration.type ? 'TSEnumDeclaration' : `${stmt.type} TSEnumDeclaration`);
    }

    if (declaration?.type === 'VariableDeclaration') {
      for (const decl of declaration.declarations ?? []) {
        if (decl.id?.type === 'Identifier' && fnLike(decl.init)) {
          pushMatch(decl.id.name, null, owner, stmt.type === declaration.type ? 'VariableDeclaration' : `${stmt.type} VariableDeclaration`);
        }
      }
    }
  }

  const filteredMatches = matches.filter((match) => {
    if (ownerSelector) {
      return match.ownerName === ownerSelector && match.name === symbolSelector;
    }
    return match.name === symbolSelector;
  });

  if (filteredMatches.length === 0) {
    throw new Error(`Structural symbol target not found.\n\nMODE: replace_symbol\nNAME: ${name}\n\nNo matching function declaration, class declaration, interface declaration, enum declaration, class method, variable function declaration, exported declaration, or supported wrapper declaration was found.\nFile was not modified.`);
  }
  if (filteredMatches.length > 1) {
    const list = filteredMatches.map((m, i) => `${i + 1}. ${m.description}`).join('\n');
    throw new Error(`Structural symbol target is ambiguous.\n\nMODE: replace_symbol\nNAME: ${name}\n\nMatched ${filteredMatches.length} declarations:\n${list}\n\nUse a scoped selector such as ClassName::method or ClassName.method for methods when possible.\nFile was not modified.`);
  }
  return filteredMatches[0];
}

function splitSymbolSelector(name: string): [string | null, string] {
  const doubleColonIndex = name.indexOf('::');
  if (doubleColonIndex > 0) {
    return [name.slice(0, doubleColonIndex), name.slice(doubleColonIndex + 2)];
  }

  const dotIndex = name.indexOf('.');
  if (dotIndex > 0) {
    return [name.slice(0, dotIndex), name.slice(dotIndex + 1)];
  }

  return [null, name];
}
