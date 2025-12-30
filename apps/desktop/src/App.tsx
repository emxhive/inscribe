import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';

type Mode = 'intake' | 'review';
type BlockStatus = 'success' | 'warn';

interface ParsedBlock {
  file: string;
  language: string;
  lines: number;
  status: BlockStatus;
  content: string;
}

interface HistoryEntry {
  stack: string[];
  index: number;
}

const MOCK_COUNTS = {
  scopeCount: 12,
  ignoreCount: 3,
  suggestedCount: 5,
  indexedCount: 182,
  status: 'Idle',
};

const MOCK_REPO_ROOT = '/path/to/project/inscribe';

const MOCK_PARSED_BLOCKS: ParsedBlock[] = [
  {
    file: 'src/components/Button.tsx',
    language: 'typescript',
    lines: 16,
    status: 'success',
    content: `import React from 'react';

type ButtonProps = {
  label: string;
  onClick?: () => void;
};

export function Button({ label, onClick }: ButtonProps) {
  return (
    <button className="btn" onClick={onClick}>
      {label}
    </button>
  );
}
`,
  },
  {
    file: 'src/hooks/useTheme.ts',
    language: 'typescript',
    lines: 24,
    status: 'warn',
    content: `import { useMemo, useState } from 'react';

type ThemeMode = 'light' | 'dark';

export function useTheme(initial: ThemeMode = 'light') {
  const [mode, setMode] = useState<ThemeMode>(initial);

  return useMemo(
    () => ({
      mode,
      toggle: () => setMode((current) => (current === 'light' ? 'dark' : 'light')),
    }),
    [mode]
  );
}
`,
  },
  {
    file: 'src/styles/globals.css',
    language: 'css',
    lines: 14,
    status: 'success',
    content: `:root {
  --background: #0f172a;
  --surface: #111827;
}

body {
  background: var(--background);
  color: #e2e8f0;
  font-family: 'Inter', system-ui, sans-serif;
}
`,
  },
];

const buildInitialHistories = (blocks: ParsedBlock[]): Record<string, HistoryEntry> =>
  blocks.reduce<Record<string, HistoryEntry>>((acc, block) => {
    acc[block.file] = { stack: [block.content], index: 0 };
    return acc;
  }, {});

const MOCK_TAG = '(mock)';
const HISTORY_LIMIT = 100;

export default function App() {
  const [mode, setMode] = useState<Mode>('intake');
  const [repoRoot] = useState(MOCK_REPO_ROOT);
  const [aiResponse, setAiResponse] = useState('');
  const [parsedBlocks, setParsedBlocks] = useState<ParsedBlock[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [histories, setHistories] = useState<Record<string, HistoryEntry>>({});
  const [editorValue, setEditorValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Idle');

  const baseContentMap = useMemo(
    () =>
      parsedBlocks.reduce<Record<string, string>>((acc, block) => {
        acc[block.file] = block.content;
        return acc;
      }, {}),
    [parsedBlocks]
  );

  const getBaseContent = useCallback(
    (file: string) => baseContentMap[file] ?? '',
    [baseContentMap]
  );

  const initializeSelection = (blocks: ParsedBlock[]) => {
    const initialHistories = buildInitialHistories(blocks);
    setHistories(initialHistories);
    const firstFile = blocks[0]?.file ?? '';
    setSelectedFile(firstFile);
    setEditorValue(blocks[0]?.content ?? '');
    setIsEditing(false);
  };

  const currentValueForSelected = useMemo(() => {
    if (!selectedFile) return '';
    const entry = histories[selectedFile];
    if (entry) {
      return entry.stack[entry.index] ?? '';
    }
    return getBaseContent(selectedFile);
  }, [histories, selectedFile, getBaseContent]);

  useEffect(() => {
    setEditorValue(currentValueForSelected);
  }, [currentValueForSelected]);

  const handleParseBlocks = () => {
    setParsedBlocks(MOCK_PARSED_BLOCKS);
    initializeSelection(MOCK_PARSED_BLOCKS);
    setMode('review');
    setStatusMessage('Ready to review parsed code blocks');
  };

  const handleSelectFile = (file: string) => {
    setSelectedFile(file);
    if (!histories[file]) {
      const base = getBaseContent(file);
      setHistories((prev) => ({ ...prev, [file]: { stack: [base], index: 0 } }));
    }
    setIsEditing(false);
  };

  const handleEditorChange = (value: string) => {
    if (!selectedFile) return;
    setHistories((prev) => {
      const current = prev[selectedFile];
      const baseStack = current
        ? current.stack.slice(0, current.index + 1)
        : [getBaseContent(selectedFile)];
      const nextStack = [...baseStack, value];
      const trimmedStack = nextStack.slice(-HISTORY_LIMIT);
      return {
        ...prev,
        [selectedFile]: { stack: trimmedStack, index: trimmedStack.length - 1 },
      };
    });
    setEditorValue(value);
    setStatusMessage('Editing locally (UI only)');
  };

  const handleUndo = () => {
    if (!selectedFile) return;
    const entry = histories[selectedFile];
    if (!entry || entry.index === 0) return;
    const nextIndex = entry.index - 1;
    setHistories((prev) => ({
      ...prev,
      [selectedFile]: { ...entry, index: nextIndex },
    }));
    setEditorValue(entry.stack[nextIndex] ?? '');
    setStatusMessage('Undid local change');
  };

  const handleRedo = () => {
    if (!selectedFile) return;
    const entry = histories[selectedFile];
    if (!entry || entry.index >= entry.stack.length - 1) return;
    const nextIndex = entry.index + 1;
    setHistories((prev) => ({
      ...prev,
      [selectedFile]: { ...entry, index: nextIndex },
    }));
    setEditorValue(entry.stack[nextIndex] ?? '');
    setStatusMessage('Redid local change');
  };

  const handleResetAll = () => {
    if (parsedBlocks.length === 0) return;
    initializeSelection(parsedBlocks);
    setStatusMessage('Reset to suggested changes');
  };

  const handleApplySelected = () => {
    if (!selectedFile) return;
    setStatusMessage(`Applied ${selectedFile} ${MOCK_TAG}`);
  };

  const handleApplyAll = () => {
    setStatusMessage(`Applied all changes ${MOCK_TAG}`);
  };

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand">Inscribe</div>

        <div className="repo-field">
          <span className="label">Repository</span>
          <div className="repo-input">
            <input value={repoRoot} readOnly />
            <div className="repo-actions">
              <button type="button" title="Edit path (UI only)" aria-label="Edit repository path">
                ✏️
              </button>
              <button type="button" title="Browse (UI only)" aria-label="Browse for repository">
                📂
              </button>
            </div>
          </div>
        </div>

        <div className="status-pills">
          <span className="pill pill-secondary">Scope: {MOCK_COUNTS.scopeCount}</span>
          <span className="pill pill-secondary">Ignore: {MOCK_COUNTS.ignoreCount}</span>
          <span className="pill pill-secondary">Suggested: {MOCK_COUNTS.suggestedCount}</span>
          <span className="pill">Indexed: {MOCK_COUNTS.indexedCount} files</span>
          <span className="pill accent">{MOCK_COUNTS.status}</span>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div>
              <p className="eyebrow">
                {mode === 'intake' ? 'Parsed Code Blocks' : 'Code Changes'}
              </p>
              <h3>{mode === 'intake' ? '0 files' : `${parsedBlocks.length} files`}</h3>
            </div>
          </div>

          {mode === 'intake' && (
            <div className="empty-state">
              <div className="empty-icon">📄</div>
              <p>Paste AI response to begin</p>
            </div>
          )}

          {mode === 'review' && (
            <ul className="file-list">
              {parsedBlocks.map((block) => (
                <li
                  key={block.file}
                  className={`file-item ${selectedFile === block.file ? 'selected' : ''}`}
                  onClick={() => handleSelectFile(block.file)}
                >
                  <div className="file-header">
                    <span
                      className={`status-icon ${block.status === 'warn' ? 'warn' : 'success'}`}
                      role="img"
                      aria-label={block.status === 'warn' ? 'Warning' : 'Success'}
                    >
                      {block.status === 'warn' ? '⚠' : '●'}
                    </span>
                    <span className="file-path">{block.file}</span>
                  </div>
                  <div className="meta">
                    <span>{block.lines} lines</span>
                    <span>•</span>
                    <span>{block.language}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="main-panel">
          {mode === 'intake' && (
            <section className="intake-card">
              <header className="section-header">
                <div>
                  <p className="eyebrow">AI Response Input</p>
                  <h2>Paste the AI reply to parse code blocks</h2>
                </div>
                <span className="section-hint">UI only • Parsing mocked</span>
              </header>

              <div className="input-area">
                <textarea
                  placeholder="Paste the AI response here. Parsing is UI-only for now."
                  value={aiResponse}
                  onChange={(e) => setAiResponse(e.target.value)}
                />
              </div>

              <footer className="intake-footer">
                <span className="char-count">{aiResponse.length} characters</span>
                <button className="primary-btn" type="button" onClick={handleParseBlocks}>
                  Parse Code Blocks
                </button>
              </footer>
            </section>
          )}

          {mode === 'review' && (
            <section className="review-panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Review & Apply</p>
                  <h2>{selectedFile || 'Select a file from the left'}</h2>
                </div>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setIsEditing((prev) => !prev)}
                >
                  {isEditing ? 'Preview' : 'Edit'}
                </button>
              </div>

              <div className="editor-shell">
                {isEditing ? (
                  <textarea
                    className="code-editor"
                    value={editorValue}
                    onChange={(e) => handleEditorChange(e.target.value)}
                  />
                ) : (
                  <pre className="code-preview">
                    <code>{editorValue}</code>
                  </pre>
                )}
              </div>

              <div className="action-bar">
                <button type="button" onClick={handleUndo}>
                  Undo
                </button>
                <button type="button" onClick={handleRedo}>
                  Redo
                </button>
                <button type="button" onClick={handleResetAll}>
                  Reset All
                </button>
                <div className="action-spacer" />
                <button type="button" className="ghost-btn" onClick={handleApplySelected}>
                  Apply Selected
                </button>
                <button type="button" className="primary-btn" onClick={handleApplyAll}>
                  Apply All Changes
                </button>
              </div>

              <div className="status-banner">{statusMessage}</div>
            </section>
          )}
        </main>

        <aside className="right-rail">
          <button
            type="button"
            className="rail-btn"
            aria-label="View history"
            onClick={() => setStatusMessage('History (placeholder)')}
          >
            🕑
          </button>
          <button
            type="button"
            className="rail-btn"
            aria-label="Open settings"
            onClick={() => setStatusMessage('Settings (placeholder)')}
          >
            ⚙️
          </button>
          <button
            type="button"
            className="rail-btn"
            aria-label="Show information"
            onClick={() => setStatusMessage('Info (placeholder)')}
          >
            ℹ️
          </button>
        </aside>
      </div>
    </div>
  );
}
