import {
  useEffect,
  useState,
} from 'react';
import type { CliCommandSuggestion } from '@inscribe/shared';
import type { TerminalShellPreference } from '@/types';
import { serializeTerminalBuffer } from '@/utils/terminal/terminalBuffer';
import { syncTerminalDimensions } from '@/utils/terminal/terminalDimensions';
import { useTerminalLifecycle } from './useTerminalLifecycle';

type UseTerminalSessionOptions = {
  repoRoot: string | null;
  suggestions: CliCommandSuggestion[];
  isOpen: boolean;
  shellPreference: TerminalShellPreference;
};

export function useTerminalSession({
  repoRoot,
  suggestions,
  isOpen,
  shellPreference,
}: UseTerminalSessionOptions) {
  const [
    restartCounter,
    setRestartCounter,
  ] = useState(0);

  const {
    terminalElementRef,
    terminalRef,
    fitAddonRef,
    sessionIdRef,
    lastInteractionTextRef,
    activeSessionId,
    shellInfo,
    terminalError,
    isExited,
    hasLastInteraction,
  } = useTerminalLifecycle({
    repoRoot,
    suggestions,
    isOpen,
    shellPreference,
    restartCounter,
  });

  useEffect(() => {
    if (
      !isOpen ||
      !terminalElementRef.current ||
      !terminalRef.current ||
      !fitAddonRef.current
    ) {
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container =
          terminalElementRef.current;

        const terminal =
          terminalRef.current;

        const fitAddon =
          fitAddonRef.current;

        if (
          !container ||
          !terminal ||
          !fitAddon
        ) {
          return;
        }

        void syncTerminalDimensions({
          container,
          terminal,
          fitAddon,
          sessionId:
            sessionIdRef.current,
          focus: true,
        }).catch(() => {
          // Ignored during layout transitions
        });
      });
    });
  }, [
    isOpen,
    fitAddonRef,
    sessionIdRef,
    terminalElementRef,
    terminalRef,
  ]);

  const restart = () => {
    setRestartCounter(
      (current) => current + 1,
    );
  };

  const copyAll = async () => {
    const terminal =
      terminalRef.current;

    if (!terminal) {
      return;
    }

    const text =
      serializeTerminalBuffer(terminal);

    if (text) {
      await navigator.clipboard.writeText(
        text,
      );
    }
  };

  const copyLast = async () => {
    const text =
      lastInteractionTextRef.current;

    if (text) {
      await navigator.clipboard.writeText(
        text,
      );
    }
  };

  const copySelection = async (selection: string) => {
    if (selection) {
      await navigator.clipboard.writeText(selection);
    }
  };

  const getSelection = () =>
    terminalRef.current?.getSelection() ?? '';

  return {
    terminalElementRef,
    activeSessionId,
    shellInfo,
    terminalError,
    isExited,
    hasLastInteraction,
    restart,
    copyAll,
    copyLast,
    copySelection,
    getSelection,
  };
}
