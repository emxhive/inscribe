import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { useAppStateContext, useParsingActions, useIntakeBlocks } from '@/hooks';
import { AlertCircle, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function IntakePanel() {
  const { state, updateState } = useAppStateContext();
  const { handleParseBlocks } = useParsingActions();
  const canParse = Boolean(state.repoRoot);
  const { lines } = useIntakeBlocks();
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const overlayRef = useRef<HTMLPreElement | null>(null);
  const indentString = '\t';
  const isOverlayActive = state.overlayEditor === 'intake';

  const lineClasses = useMemo(() => {
    return lines.map((line) => {
      return cn(
        'whitespace-pre-wrap',
        line.blockId === state.selectedIntakeBlockId && 'bg-primary/10',
        line.type === 'begin' && 'text-sky-800 bg-sky-100/70',
        line.type === 'end' && 'text-sky-800 bg-sky-100/70',
        line.type === 'header' && 'text-indigo-800 bg-indigo-100/60',
        line.type === 'directive' && 'text-emerald-800 bg-emerald-100/60',
        line.type === 'unknown-directive' && 'text-amber-800 bg-amber-100/70',
        line.status === 'warning' && 'bg-amber-200/70 text-amber-900',
        line.status === 'error' && 'bg-red-200/70 text-red-900',
      );
    });
  }, [lines, state.selectedIntakeBlockId]);

  useEffect(() => {
    const textarea = textAreaRef.current;
    if (!textarea) {
      return;
    }
    const overlay = overlayRef.current;
    if (overlay) {
      overlay.scrollTop = textarea.scrollTop;
      overlay.scrollLeft = textarea.scrollLeft;
    }
  }, [state.aiInput]);

  useEffect(() => {
    const textarea = textAreaRef.current;
    if (!textarea || !state.selectedIntakeBlockId) {
      return;
    }
    const selectedLineIndex = lines.find((line) => line.blockId === state.selectedIntakeBlockId)?.lineIndex;
    if (selectedLineIndex === undefined) {
      return;
    }
    const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight || '0');
    if (!Number.isFinite(lineHeight) || lineHeight === 0) {
      return;
    }
    textarea.scrollTop = Math.max(0, selectedLineIndex * lineHeight - lineHeight * 2);
    if (overlayRef.current) {
      overlayRef.current.scrollTop = textarea.scrollTop;
    }
  }, [lines, state.selectedIntakeBlockId]);

  useEffect(() => {
    if (state.overlayEditor !== 'intake') {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      updateState({ overlayEditor: null });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.overlayEditor, updateState]);

  useEffect(() => {
    if (state.overlayEditor !== 'intake') {
      return;
    }
    const { style } = document.body;
    const previousOverflow = style.overflow;
    style.overflow = 'hidden';
    return () => {
      style.overflow = previousOverflow;
    };
  }, [state.overlayEditor]);

  const handleScroll = () => {
    if (!overlayRef.current || !textAreaRef.current) {
      return;
    }
    overlayRef.current.scrollTop = textAreaRef.current.scrollTop;
    overlayRef.current.scrollLeft = textAreaRef.current.scrollLeft;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Tab') {
      return;
    }
    event.preventDefault();
    const textarea = textAreaRef.current;
    if (!textarea) {
      return;
    }
    const { selectionStart, selectionEnd, value } = textarea;
    const newValue = `${value.slice(0, selectionStart)}${indentString}${value.slice(selectionEnd)}`;
    const nextSelectionStart = selectionStart + indentString.length;
    const nextSelectionEnd = selectionEnd + indentString.length;
    updateState({ aiInput: newValue });
    requestAnimationFrame(() => {
      if (!textAreaRef.current) {
        return;
      }
      textAreaRef.current.selectionStart = nextSelectionStart;
      textAreaRef.current.selectionEnd = nextSelectionEnd;
    });
  };

  const editorSurface = (
    <div className="relative w-full h-full border border-border rounded-lg bg-secondary focus-within:ring-2 focus-within:ring-primary focus-within:border-primary">
      <pre
        ref={overlayRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-auto p-3 text-sm leading-relaxed font-mono text-transparent"
      >
        {lines.map((line, index) => (
          <div key={`${line.lineIndex}-${index}`} className={lineClasses[index]}>
            {line.text.length === 0 ? ' ' : line.text}
          </div>
        ))}
      </pre>
      <textarea
        ref={textAreaRef}
        className="relative z-10 w-full h-full resize-none rounded-lg bg-transparent p-3 text-sm leading-relaxed font-mono text-foreground focus:outline-none"
        placeholder="Paste the AI response here. Must contain @inscribe BEGIN / END blocks."
        value={state.aiInput}
        onChange={(e) => updateState({ aiInput: e.target.value })}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
      />
    </div>
  );

  return (
    <section className="flex flex-col gap-3.5 h-full min-h-0 bg-card border border-border rounded-xl shadow-md p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">AI Response Input</p>
          <h2 className="text-xl font-semibold mt-0.5">Paste the AI reply to parse code blocks</h2>
        </div>
        <Button
          variant="outline"
          size="icon"
          type="button"
          onClick={() => updateState({ overlayEditor: 'intake' })}
          aria-label="Open intake overlay editor"
          title="Open intake overlay editor"
        >
          <Maximize2 />
        </Button>
      </header>

      {state.parseErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-900 px-4 py-3 rounded-md mb-4 text-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-4 w-4" />
            <strong>Parse Errors:</strong>
          </div>
          <ul className="mt-2 ml-5 list-disc">
            {state.parseErrors.map((error, idx) => (
              <li key={idx} className="mb-1">{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex-1 min-h-[320px]">
        {isOverlayActive ? <div className="w-full h-full" /> : editorSurface}
      </div>

      <footer className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{state.aiInput.length} characters</span>
        <Button
          type="button"
          onClick={handleParseBlocks}
          disabled={!canParse || state.isParsingInProgress}
          title={!canParse ? 'Select a repository first' : state.isParsingInProgress ? 'Parsing in progress...' : ''}
        >
          {state.isParsingInProgress ? 'Parsing...' : 'Parse Code Blocks'}
        </Button>
      </footer>
      {isOverlayActive && typeof document !== 'undefined'
        ? createPortal(
          <div className="fixed inset-0 z-[100] bg-black/60">
            <div className="w-full h-full">
              {editorSurface}
            </div>
          </div>,
          document.body,
        )
        : null}
    </section>
  );
}
