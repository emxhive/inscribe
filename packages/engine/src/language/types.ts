export interface StructuralSymbolRange {
  start: number;
  end: number;
  description: string;
}

export interface StructuralLanguageAdapter {
  id: string;
  supportsFile(filePath: string): boolean;
  resolveSymbolDeclarationRange(content: string, name: string): StructuralSymbolRange;
  validateCandidate?(filePath: string, candidate: string): void;
}
