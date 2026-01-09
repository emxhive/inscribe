import React from 'react';
import { Button } from '../common';
import { useAppStateContext, useParsingActions } from '../../hooks';

export function IntakePanel() {
  const { state, updateState } = useAppStateContext();
  const { handleParseBlocks } = useParsingActions();
  const canParse = Boolean(state.repoRoot);

  return (
    <section className="intake-card">
      <header className="section-header">
        <div>
          <p className="eyebrow">AI Response Input</p>
          <h2>Paste the AI reply to parse code blocks</h2>
        </div>
      </header>

      {state.parseErrors.length > 0 && (
        <div className="error-banner">
          <strong>Parse Errors:</strong>
          <ul>
            {state.parseErrors.map((error, idx) => (
              <li key={idx}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="input-area">
        <textarea
          placeholder="Paste the AI response here. Must contain @inscribe BEGIN / END blocks."
          value={state.aiInput}
          onChange={(e) => updateState({ aiInput: e.target.value })}
        />
      </div>

      <footer className="intake-footer">
        <span className="char-count">{state.aiInput.length} characters</span>
        <Button
          variant="primary"
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
