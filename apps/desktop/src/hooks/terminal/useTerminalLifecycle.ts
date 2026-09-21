import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import type { CliCommandSuggestion } from '@inscribe/shared';
import type {
  TerminalDataEvent,
  TerminalSessionExitEvent,
  TerminalShellKind,
  TerminalShellPreference,
} from '@/types';
import {
  createTerminalKeyboardController,
  type TerminalKeyboardController,
} from '@/utils/terminal/terminalKeyboard';
import { attachTerminalShellIntegration } from '@/utils/terminal/terminalShellIntegration';
import { syncTerminalDimensions } from '@/utils/terminal/terminalDimensions';

type UseTerminalLifecycleOptions = {
  repoRoot: string | null;
  suggestions: CliCommandSuggestion[];
  isOpen: boolean;
  shellPreference: TerminalShellPreference;
  restartCounter: number;
};

export function useTerminalLifecycle({
  repoRoot,
  suggestions,
  isOpen,
  shellPreference,
  restartCounter,
}: UseTerminalLifecycleOptions) {
  const terminalElementRef =
    useRef<HTMLDivElement | null>(null);

  const terminalRef =
    useRef<Terminal | null>(null);

  const fitAddonRef =
    useRef<FitAddon | null>(null);

  const sessionIdRef =
    useRef<string | null>(null);

  const shellKindRef =
    useRef<TerminalShellKind>('posix');

  const suggestionsRef =
    useRef<CliCommandSuggestion[]>(suggestions);

  const keyboardControllerRef =
    useRef<TerminalKeyboardController | null>(
      null,
    );

  const pendingTerminalDataRef =
    useRef<Map<string, string[]>>(
      new Map(),
    );

  const lastInteractionTextRef =
    useRef('');

  const [
    activeSessionId,
    setActiveSessionId,
  ] = useState<string | null>(null);

  const [
    shellInfo,
    setShellInfo,
  ] = useState('');

  const [
    terminalError,
    setTerminalError,
  ] = useState<string | null>(null);

  const [
    isExited,
    setIsExited,
  ] = useState(false);

  const [
    hasLastInteraction,
    setHasLastInteraction,
  ] = useState(false);

  useEffect(() => {
    suggestionsRef.current = suggestions;

    keyboardControllerRef.current
      ?.resetSuggestionIndex();
  }, [suggestions]);

  useEffect(() => {
    const container =
      terminalElementRef.current;

    if (
      !container ||
      !repoRoot
    ) {
      return;
    }

    setTerminalError(null);
    setIsExited(false);
    setHasLastInteraction(false);

    lastInteractionTextRef.current = '';
    pendingTerminalDataRef.current.clear();

    const terminal = new Terminal({
      allowProposedApi: false,
      cursorBlink: true,
      disableStdin: false,
      fontFamily:
        'JetBrains Mono, ui-monospace, SFMono-Regular, Consolas, monospace',
      fontSize: 12,
      lineHeight: 1.35,
      scrollback: 5000,
      theme: {
        background: '#090d16',
        foreground: '#e2e8f0',
        cursor: '#60a5fa',
        selectionBackground: '#334155',
      },
    });

    const fitAddon = new FitAddon();

    terminal.loadAddon(fitAddon);
    terminal.open(container);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const shellIntegrationDisposable =
      attachTerminalShellIntegration({
        terminal,
        onInteractionComplete:
          (interaction) => {
            lastInteractionTextRef.current =
              interaction;

            setHasLastInteraction(true);
          },
      });

    const keyboardController =
      createTerminalKeyboardController({
        terminal,
        getSessionId: () =>
          sessionIdRef.current,
        getShellKind: () =>
          shellKindRef.current,
        getSuggestions: () =>
          suggestionsRef.current,
      });

    keyboardControllerRef.current =
      keyboardController;

    terminal.attachCustomKeyEventHandler(
      keyboardController.handleKeyEvent,
    );

    const dataDisposable =
      terminal.onData((data) => {
        const sessionId =
          sessionIdRef.current;

        if (!sessionId) {
          return;
        }

        void window.inscribeAPI.terminalWrite(
          sessionId,
          data,
        );
      });

    const fitAndResize = () => {
      void syncTerminalDimensions({
        container,
        terminal,
        fitAddon,
        sessionId:
          sessionIdRef.current,
      }).catch(() => {
        // Ignored during layout transitions
      });
    };

    const resizeObserver =
      new ResizeObserver(
        fitAndResize,
      );

    resizeObserver.observe(container);

    let isDisposed = false;

    requestAnimationFrame(() => {
      if (isDisposed) {
        return;
      }

      fitAndResize();

      if (isDisposed) {
        return;
      }

      void window.inscribeAPI
        .terminalCreate({
          cwd: repoRoot,
          cols: terminal.cols || 80,
          rows: terminal.rows || 24,
          shellPreference,
        })
        .then((info) => {
          if (isDisposed) {
            void window.inscribeAPI
              .terminalDispose(
                info.sessionId,
              );

            return;
          }

          sessionIdRef.current =
            info.sessionId;

          const pendingData =
            pendingTerminalDataRef.current.get(
              info.sessionId,
            );

          if (pendingData?.length) {
            terminal.write(
              pendingData.join(''),
            );
          }

          pendingTerminalDataRef.current.clear();

          shellKindRef.current =
            info.shellKind;

          setActiveSessionId(
            info.sessionId,
          );

          setShellInfo(info.shell);

          fitAndResize();

          if (isOpen) {
            requestAnimationFrame(
              () => terminal.focus(),
            );
          }
        })
        .catch((error) => {
          if (isDisposed) {
            return;
          }

          const message =
            error instanceof Error
              ? error.message
              : String(error);

          setTerminalError(message);

          terminal.writeln(
            `\x1b[31mTerminal startup error: ${message}\x1b[0m`,
          );
        });
    });

    const removeDataListener =
      window.inscribeAPI.onTerminalData(
        (event: TerminalDataEvent) => {
          if (
            event.sessionId ===
            sessionIdRef.current
          ) {
            terminal.write(event.data);
            return;
          }

          if (
            sessionIdRef.current === null
          ) {
            const pendingData =
              pendingTerminalDataRef.current.get(
                event.sessionId,
              ) ?? [];

            pendingData.push(event.data);

            pendingTerminalDataRef.current.set(
              event.sessionId,
              pendingData,
            );
          }
        },
      );

    const removeSessionExitListener =
      window.inscribeAPI
        .onTerminalSessionExit(
          (
            event: TerminalSessionExitEvent,
          ) => {
            if (
              event.sessionId !==
              sessionIdRef.current
            ) {
              return;
            }

            setIsExited(true);

            terminal.writeln(
              `\r\n\x1b[90m[Process exited with code ${event.exitCode ?? 0}]\x1b[0m`,
            );
          },
        );

    return () => {
      isDisposed = true;

      resizeObserver.disconnect();
      removeDataListener();
      removeSessionExitListener();

      dataDisposable.dispose();
      shellIntegrationDisposable.dispose();

      keyboardControllerRef.current = null;

      pendingTerminalDataRef.current.clear();

      if (sessionIdRef.current) {
        void window.inscribeAPI
          .terminalDispose(
            sessionIdRef.current,
          );

        sessionIdRef.current = null;
      }

      terminal.dispose();

      terminalRef.current = null;
      fitAddonRef.current = null;

      setActiveSessionId(null);
    };
  }, [
    repoRoot,
    shellPreference,
    restartCounter,
  ]);

  return {
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
  };
}