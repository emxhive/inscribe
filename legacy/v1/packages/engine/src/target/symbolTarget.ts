import { StructuralLanguageAdapter } from '../language/types';

export function resolveSymbolTarget(content: string, directives: Record<string, string>, adapter: StructuralLanguageAdapter): { replaceStart:number; replaceEnd:number } {
  const name = directives.NAME;
  if (!name) throw new Error('replace_symbol requires NAME directive');
  const r = adapter.resolveSymbolDeclarationRange(content, name);
  return { replaceStart: r.start, replaceEnd: r.end };
}
