export interface V2DiffHunk {
  id: string;
  kind: 'insert' | 'delete' | 'replace';
  oldRange: { start: number; end: number };
  newRange: { start: number; end: number };
  oldText: string;
  newText: string;
  oldStartLine: number;
  oldEndLine: number;
  newStartLine: number;
  newEndLine: number;
}
