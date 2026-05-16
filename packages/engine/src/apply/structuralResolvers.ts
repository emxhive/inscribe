import { parse } from '@babel/parser';

function parseAst(content: string) {
  return parse(content, { sourceType: 'unambiguous', plugins: ['typescript', 'jsx'] });
}

export function resolveJsxRangeFromStart(content: string, startAnchor: string, contains: string[]): { start: number; end: number } {
  const ast = parseAst(content) as any;
  const matches: Array<{ start: number; end: number }> = [];

  function visit(node: any): void {
    if (!node || typeof node !== 'object') return;
    if ((node.type === 'JSXElement' || node.type === 'JSXFragment') && typeof node.start === 'number' && typeof node.end === 'number') {
      const text = content.slice(node.start, node.end);
      const openIdx = text.indexOf(startAnchor);
      if (openIdx !== -1) {
        const ok = contains.every(value => text.includes(value));
        if (ok) matches.push({ start: node.start, end: node.end });
      }
    }
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  }

  visit(ast);
  if (matches.length === 0) {
    throw new Error('No JSX candidate matched START + CONTAINS.\nFile was not modified.');
  }
  if (matches.length > 1) {
    throw new Error(`Structural range is ambiguous.\nMatched candidates after filtering: ${matches.length}\nFile was not modified.`);
  }
  return matches[0];
}

export function resolveSymbolDeclarationRange(content: string, name: string): { start: number; end: number; description: string } {
  const ast = parseAst(content) as any;
  const matches: Array<{ start: number; end: number; description: string }> = [];

  function rangeFor(owner: any, description: string): { start: number; end: number; description: string } {
    return { start: owner.start, end: owner.end, description: `${description} at line ${owner.loc.start.line}` };
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

  for (const stmt of ast.program.body as any[]) {
    const declaration = stmt.type === 'ExportNamedDeclaration' || stmt.type === 'ExportDefaultDeclaration'
      ? stmt.declaration
      : stmt;
    const owner = stmt.type === 'ExportNamedDeclaration' || stmt.type === 'ExportDefaultDeclaration'
      ? stmt
      : declaration;

    if (declaration?.type === 'FunctionDeclaration' && declaration.id?.name === name) {
      matches.push(rangeFor(owner, stmt.type === declaration.type ? 'FunctionDeclaration' : `${stmt.type} FunctionDeclaration`));
    }

    if (declaration?.type === 'ClassDeclaration' && declaration.id?.name === name) {
      matches.push(rangeFor(owner, stmt.type === declaration.type ? 'ClassDeclaration' : `${stmt.type} ClassDeclaration`));
    }

    if (declaration?.type === 'VariableDeclaration') {
      for (const decl of declaration.declarations ?? []) {
        if (decl.id?.type === 'Identifier' && decl.id.name === name && fnLike(decl.init)) {
          matches.push(rangeFor(owner, stmt.type === declaration.type ? 'VariableDeclaration' : `${stmt.type} VariableDeclaration`));
        }
      }
    }
  }
  if (matches.length === 0) {
    throw new Error(`Structural symbol target not found.\n\nMODE: replace_symbol\nNAME: ${name}\n\nNo matching function declaration, class declaration, variable function declaration, exported declaration, or supported wrapper declaration was found.\nFile was not modified.`);
  }
  if (matches.length > 1) {
    const list = matches.map((m, i) => `${i + 1}. ${m.description}`).join('\n');
    throw new Error(`Structural symbol target is ambiguous.\n\nMODE: replace_symbol\nNAME: ${name}\n\nMatched ${matches.length} declarations:\n${list}\n\nFile was not modified.`);
  }
  return matches[0];
}
