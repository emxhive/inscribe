import type { Terminal } from '@xterm/xterm';

export interface TerminalBufferPosition {
  line: number;
  column: number;
}

export function getTerminalBufferPosition(
  terminal: Terminal,
): TerminalBufferPosition {
  const buffer = terminal.buffer.active;

  return {
    line: buffer.baseY + buffer.cursorY,
    column: buffer.cursorX,
  };
}

export function serializeTerminalRange(
  terminal: Terminal,
  start: TerminalBufferPosition,
  end: TerminalBufferPosition,
): string {
  if (
    end.line < start.line ||
    (
      end.line === start.line &&
      end.column <= start.column
    )
  ) {
    return '';
  }

  const buffer = terminal.buffer.active;

  if (buffer.length === 0) {
    return '';
  }

  const firstLine = Math.max(
    0,
    Math.min(start.line, buffer.length - 1),
  );

  const lastLine = Math.max(
    firstLine,
    Math.min(end.line, buffer.length - 1),
  );

  const logicalLines: string[] = [];

  for (
    let index = firstLine;
    index <= lastLine;
    index++
  ) {
    const line = buffer.getLine(index);

    if (!line) continue;

    const startColumn =
      index === firstLine
        ? start.column
        : 0;

    const endColumn =
      index === lastLine
        ? end.column
        : undefined;

    const text = line.translateToString(
      true,
      startColumn,
      endColumn,
    );

    if (
      line.isWrapped &&
      logicalLines.length > 0 &&
      index !== firstLine
    ) {
      logicalLines[logicalLines.length - 1] += text;
    } else {
      logicalLines.push(text);
    }
  }

  return logicalLines.join('\n').trimEnd();
}

export function serializeTerminalBuffer(
  terminal: Terminal,
  startLine = 0,
): string {
  const buffer = terminal.buffer.active;
  const logicalLines: string[] = [];

  for (
    let index = Math.max(0, startLine);
    index < buffer.length;
    index++
  ) {
    const line = buffer.getLine(index);

    if (!line) continue;

    const text = line.translateToString(true);

    if (
      line.isWrapped &&
      logicalLines.length > 0
    ) {
      logicalLines[logicalLines.length - 1] += text;
    } else {
      logicalLines.push(text);
    }
  }

  return logicalLines.join('\n').trimEnd();
}