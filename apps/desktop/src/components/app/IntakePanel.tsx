import React from 'react';
import { Button } from '../common';

interface IntakePanelProps {
  aiInput: string;
  parseErrors: string[];
  isParsingInProgress: boolean;
  canParse: boolean;
  onAiInputChange: (value: string) => void;
  onParseBlocks: () => void;
}

export function IntakePanel({
  aiInput,
  parseErrors,
  isParsingInProgress,
  canParse,
  onAiInputChange,
  onParseBlocks,
}: IntakePanelProps) {
  return (
    <section className="intake-card">
      <header className="section-header">
        <div>
          <p className="eyebrow">AI Response Input</p>
          <h2>Paste the AI reply to parse code blocks</h2>
        </div>
      </header>

      {parseErrors.length > 0 && (
        <div className="error-banner">
          <strong>Parse Errors:</strong>
          <ul>
            {parseErrors.map((error, idx) => (
              <li key={idx}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="input-area">
        <textarea
          placeholder="Paste the AI response here. Must contain @inscribe BEGIN / END blocks."
          value={aiInput}
          onChange={(e) => onAiInputChange(e.target.value)}
        />
      </div>

      <footer className="intake-footer">
        <span className="char-count">{aiInput.length} characters</span>
        <Button
          variant="primary"
          type="button"
          onClick={onParseBlocks}
          disabled={!canParse || isParsingInProgress}
          title={!canParse ? 'Select a repository first' : isParsingInProgress ? 'Parsing in progress...' : ''}
        >
          {isParsingInProgress ? 'Parsing...' : 'Parse Code Blocks'}
        </Button>
      </footer>
    </section>
  );
}
