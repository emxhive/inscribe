import React from 'react';
import { Button } from '@/components/ui/button';
import { useAppStateContext, useParsingActions } from '@/hooks';
import { AlertCircle } from 'lucide-react';

export function IntakePanel() {
  const { state, updateState } = useAppStateContext();
  const { handleParseBlocks } = useParsingActions();
  const canParse = Boolean(state.repoRoot);

  return (
    <section className="flex flex-col gap-3.5 h-full min-h-0 bg-card border border-border rounded-xl shadow-md p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">AI Response Input</p>
          <h2 className="text-xl font-semibold mt-0.5">Paste the AI reply to parse code blocks</h2>
        </div>
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
        <textarea
          className="w-full h-full resize-none border border-border rounded-lg p-3 text-sm leading-relaxed font-mono text-foreground bg-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          placeholder="Paste the AI response here. Must contain @inscribe BEGIN / END blocks."
          value={state.aiInput}
          onChange={(e) => updateState({ aiInput: e.target.value })}
        />
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
    </section>
  );
}
