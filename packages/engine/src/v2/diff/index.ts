import { diffLinesStable } from '../../diff/lineDiff';
import { V2DiffHunk } from '@inscribe/shared';

export function computeDiffHunks(oldContent: string, newContent: string): V2DiffHunk[] {
  if (oldContent === newContent) {
    return [];
  }

  const parts = diffLinesStable(oldContent, newContent);
  const hunks: V2DiffHunk[] = [];

  let oldOffset = 0;
  let newOffset = 0;
  let oldLine = 1;
  let newLine = 1;

  let hunkCounter = 0;
  let i = 0;

  while (i < parts.length) {
    const part = parts[i];

    if (!part.added && !part.removed) {
      const linesCount = (part.value.match(/\n/g) || []).length;
      oldOffset += part.value.length;
      newOffset += part.value.length;
      oldLine += linesCount;
      newLine += linesCount;
      i++;
    } else {
      let groupOldText = '';
      let groupNewText = '';
      const groupOldStartOffset = oldOffset;
      const groupNewStartOffset = newOffset;
      const groupOldStartLine = oldLine;
      const groupNewStartLine = newLine;

      while (i < parts.length && (parts[i].added || parts[i].removed)) {
        const p = parts[i];
        if (p.removed) {
          groupOldText += p.value;
          const linesCount = (p.value.match(/\n/g) || []).length;
          oldOffset += p.value.length;
          oldLine += linesCount;
        } else if (p.added) {
          groupNewText += p.value;
          const linesCount = (p.value.match(/\n/g) || []).length;
          newOffset += p.value.length;
          newLine += linesCount;
        }
        i++;
      }

      let kind: 'insert' | 'delete' | 'replace' = 'replace';
      if (groupOldText.length === 0) {
        kind = 'insert';
      } else if (groupNewText.length === 0) {
        kind = 'delete';
      }

      const oldEndLine = groupOldStartLine + (groupOldText.match(/\n/g) || []).length;
      const newEndLine = groupNewStartLine + (groupNewText.match(/\n/g) || []).length;

      hunkCounter++;
      hunks.push({
        id: `hunk-${hunkCounter}`,
        kind,
        oldRange: { start: groupOldStartOffset, end: groupOldStartOffset + groupOldText.length },
        newRange: { start: groupNewStartOffset, end: groupNewStartOffset + groupNewText.length },
        oldText: groupOldText,
        newText: groupNewText,
        oldStartLine: groupOldStartLine,
        oldEndLine: Math.max(groupOldStartLine, oldEndLine - (groupOldText.endsWith('\n') ? 1 : 0)),
        newStartLine: groupNewStartLine,
        newEndLine: Math.max(groupNewStartLine, newEndLine - (groupNewText.endsWith('\n') ? 1 : 0))
      });
    }
  }

  return hunks;
}
