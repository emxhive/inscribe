import type { IntakeBlock } from './intake';

interface SourceLineSegment {
  text: string;
  newline: string;
}

function splitSourceLineSegments(input: string): SourceLineSegment[] {
  const segments: SourceLineSegment[] = [];
  let start = 0;
  let index = 0;

  while (index < input.length) {
    if (input[index] !== '\n' && input[index] !== '\r') {
      index++;
      continue;
    }

    const newline = input[index] === '\r' && input[index + 1] === '\n' ? '\r\n' : input[index];
    segments.push({ text: input.slice(start, index), newline });
    index += newline.length;
    start = index;
  }

  segments.push({ text: input.slice(start), newline: '' });
  return segments;
}

export function removeIntakeBlockFromText(input: string, block: IntakeBlock): string {
  const lines = splitSourceLineSegments(input);
  if (
    block.startLine < 0 ||
    block.endLine < block.startLine ||
    block.startLine >= lines.length
  ) {
    return input;
  }

  let removeStart = block.startLine;
  let removeEnd = Math.min(block.endLine, lines.length - 1);

  if (removeEnd + 1 < lines.length && lines[removeEnd + 1].text.trim() === '') {
    removeEnd++;
  } else if (removeStart > 0 && lines[removeStart - 1].text.trim() === '') {
    removeStart--;
  }

  lines.splice(removeStart, removeEnd - removeStart + 1);
  return lines.map((line) => `${line.text}${line.newline}`).join('');
}
