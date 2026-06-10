import { StructuralSelector, StructuralSelectorSegment, StructuralKind } from './types';

const SUPPORTED_KINDS = new Set<StructuralKind>([
  'class',
  'method',
  'function',
  'if_statement',
]);

export function parseSelectorPath(pathStr: string): StructuralSelectorSegment[] {
  const parts = pathStr.split('>').map((p) => p.trim()).filter(Boolean);
  const segments: StructuralSelectorSegment[] = [];

  for (const part of parts) {
    const colonIndex = part.indexOf(':');
    let kindStr: string;
    let name: string | undefined;

    if (colonIndex === -1) {
      kindStr = part;
    } else {
      kindStr = part.slice(0, colonIndex).trim();
      name = part.slice(colonIndex + 1).trim();
    }

    if (!SUPPORTED_KINDS.has(kindStr as any)) {
      throw new Error(`Unsupported structural selector kind: ${kindStr}`);
    }

    segments.push({
      kind: kindStr as StructuralKind,
      name: name || undefined,
    });
  }

  if (segments.length === 0) {
    throw new Error('Selector path cannot be empty');
  }

  return segments;
}

export function parseSelector(pathStr: string, startsWith?: string): StructuralSelector {
  return {
    path: parseSelectorPath(pathStr),
    startsWith,
  };
}
