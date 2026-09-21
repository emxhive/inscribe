import type { Terminal } from '@xterm/xterm';
import type { CliCommandSuggestion } from '@inscribe/shared';
import type { TerminalShellKind } from '@/types';
import { buildTerminalLineReplacement } from '@/utils/terminalLineReplacement';

type TerminalKeyboardControllerOptions = {
  terminal: Terminal;
  getSessionId: () => string | null;
  getShellKind: () => TerminalShellKind;
  getSuggestions: () => CliCommandSuggestion[];
};

export type TerminalKeyboardController = {
  handleKeyEvent: (event: KeyboardEvent) => boolean;
  resetSuggestionIndex: () => void;
};

export function createTerminalKeyboardController({
  terminal,
  getSessionId,
  getShellKind,
  getSuggestions,
}: TerminalKeyboardControllerOptions): TerminalKeyboardController {
  let suggestionIndex = -1;

  const resetSuggestionIndex = () => {
    suggestionIndex = -1;
  };

  const handleKeyEvent = (
    event: KeyboardEvent,
  ): boolean => {
    if (
      event.type === 'keydown' &&
      event.ctrlKey &&
      event.shiftKey &&
      event.key.toLowerCase() === 'c'
    ) {
      event.preventDefault();

      const selection =
        terminal.getSelection();

      if (selection) {
        void navigator.clipboard.writeText(
          selection,
        );
      }

      return false;
    }

    if (
      event.type === 'keydown' &&
      event.ctrlKey &&
      (
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown'
      )
    ) {
      event.preventDefault();

      const suggestions =
        getSuggestions();

      if (suggestions.length === 0) {
        return false;
      }

      if (event.key === 'ArrowUp') {
        suggestionIndex =
          suggestionIndex <= 0
            ? suggestions.length - 1
            : suggestionIndex - 1;
      } else {
        suggestionIndex =
          suggestionIndex >=
              suggestions.length - 1 ||
            suggestionIndex < 0
            ? 0
            : suggestionIndex + 1;
      }

      const suggestion =
        suggestions[suggestionIndex];

      const sessionId =
        getSessionId();

      if (
        suggestion &&
        sessionId
      ) {
        const replacement =
          buildTerminalLineReplacement(
            getShellKind(),
            suggestion.command,
          );

        void window.inscribeAPI.terminalWrite(
          sessionId,
          replacement,
        );
      }

      return false;
    }

    return true;
  };

  return {
    handleKeyEvent,
    resetSuggestionIndex,
  };
}