import type { Terminal } from '@xterm/xterm';
import {
  getTerminalBufferPosition,
  serializeTerminalRange,
  type TerminalBufferPosition,
} from './terminalBuffer';

type AttachTerminalShellIntegrationOptions = {
  terminal: Terminal;
  onInteractionComplete: (text: string) => void;
};

export function attachTerminalShellIntegration({
  terminal,
  onInteractionComplete,
}: AttachTerminalShellIntegrationOptions) {
  let promptStart: TerminalBufferPosition | null = null;
  let commandStarted = false;

  return terminal.parser.registerOscHandler(
    133,
    (data) => {
      const event = data.split(';', 1)[0];

      if (event === 'A') {
        promptStart =
          getTerminalBufferPosition(terminal);
        commandStarted = false;
        return true;
      }

      if (event === 'C') {
        commandStarted = true;
        return true;
      }

      if (event === 'D') {
        if (
          promptStart &&
          commandStarted
        ) {
          const interaction =
            serializeTerminalRange(
              terminal,
              promptStart,
              getTerminalBufferPosition(
                terminal,
              ),
            );

          if (interaction) {
            onInteractionComplete(interaction);
          }
        }

        commandStarted = false;
        return true;
      }

      return false;
    },
  );
}