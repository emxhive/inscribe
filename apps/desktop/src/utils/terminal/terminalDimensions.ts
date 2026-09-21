import type { FitAddon } from '@xterm/addon-fit';
import type { Terminal } from '@xterm/xterm';

type SyncTerminalDimensionsOptions = {
  container: HTMLElement;
  terminal: Terminal;
  fitAddon: FitAddon;
  sessionId: string | null;
  focus?: boolean;
};

export async function syncTerminalDimensions({
  container,
  terminal,
  fitAddon,
  sessionId,
  focus = false,
}: SyncTerminalDimensionsOptions): Promise<boolean> {
  const bounds = container.getBoundingClientRect();

  if (
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    return false;
  }

  fitAddon.fit();

  if (
    sessionId &&
    terminal.cols > 0 &&
    terminal.rows > 0
  ) {
    await window.inscribeAPI.terminalResize(
      sessionId,
      terminal.cols,
      terminal.rows,
    );
  }

  if (focus) {
    terminal.focus();
  }

  return true;
}