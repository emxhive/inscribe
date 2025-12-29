import React, { useState, useCallback } from 'react';
import RepositorySelector from './components/RepositorySelector';
import PasteArea from './components/PasteArea';
import FileList from './components/FileList';
import Preview from './components/Preview';
import ApplyControls from './components/ApplyControls';
import './App.css';

interface ParsedBlock {
  file: string;
  mode: string;
  directives: Record<string, string>;
  content: string;
}

interface FileChange {
  file: string;
  status: 'new' | 'modified' | 'error';
  error?: string;
}

export default function App() {
  const [repoRoot, setRepoRoot] = useState<string>('');
  const [pastedContent, setPastedContent] = useState<string>('');
  const [parsedBlocks, setParsedBlocks] = useState<ParsedBlock[]>([]);
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [isValid, setIsValid] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [backupPath, setBackupPath] = useState<string>('');
  const [errors, setErrors] = useState<string[]>([]);

  const handleRepositorySelect = useCallback((path: string) => {
    setRepoRoot(path);
    setPastedContent('');
    setParsedBlocks([]);
    setFileChanges([]);
    setIsValid(false);
    setErrors([]);
  }, []);

  const handlePaste = useCallback(async (content: string) => {
    setPastedContent(content);
    setErrors([]);
    setFileChanges([]);
    setIsValid(false);

    if (!repoRoot) {
      setErrors(['No repository selected']);
      return;
    }

    try {
      // Parse blocks
      const parsed = await (window as any).inscribeAPI.parseBlocks(content);

      if (parsed.errors && parsed.errors.length > 0) {
        setErrors(parsed.errors);
        setIsValid(false);
        return;
      }

      setParsedBlocks(parsed.blocks);

      // Validate blocks
      const validationErrors = await (window as any).inscribeAPI.validateBlocks(
        parsed.blocks,
        repoRoot
      );

      if (validationErrors && validationErrors.length > 0) {
        setErrors(validationErrors.map((e: any) => e.message));
        setIsValid(false);
        return;
      }

      // Build apply plan
      const plan = await (window as any).inscribeAPI.buildApplyPlan(
        parsed.blocks,
        repoRoot
      );

      if (plan.errors) {
        setErrors(plan.errors.map((e: any) => e.message));
        setIsValid(false);
        return;
      }

      const changes: FileChange[] = plan.operations.map((op: any) => ({
        file: op.file,
        status: op.type === 'create' ? 'new' : 'modified',
      }));

      setFileChanges(changes);
      setIsValid(true);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Unknown error']);
      setIsValid(false);
    }
  }, [repoRoot]);

  const handleApply = useCallback(async () => {
    if (!isValid || !repoRoot || parsedBlocks.length === 0) {
      return;
    }

    try {
      const plan = await (window as any).inscribeAPI.buildApplyPlan(
        parsedBlocks,
        repoRoot
      );

      const result = await (window as any).inscribeAPI.applyChanges(plan, repoRoot);

      if (result.success) {
        setBackupPath(result.backupPath);
        setErrors([]);
        setPastedContent('');
        setParsedBlocks([]);
        setFileChanges([]);
        setIsValid(false);
        alert('Changes applied successfully!');
      } else {
        setErrors(['Failed to apply changes']);
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Unknown error']);
    }
  }, [isValid, repoRoot, parsedBlocks]);

  const handleUndo = useCallback(async () => {
    if (!repoRoot || !backupPath) {
      return;
    }

    try {
      const result = await (window as any).inscribeAPI.undoLastApply(repoRoot);
      if (result.success) {
        setBackupPath('');
        alert('Changes undone!');
      } else {
        setErrors([result.message]);
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Unknown error']);
    }
  }, [repoRoot, backupPath]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Inscribe</h1>
        <p>Safely apply AI-generated code to your codebase</p>
      </header>

      <div className="app-container">
        <aside className="sidebar">
          <RepositorySelector
            selectedPath={repoRoot}
            onSelect={handleRepositorySelect}
          />
        </aside>

        <main className="main-content">
          <div className="paste-section">
            <PasteArea
              content={pastedContent}
              onChange={handlePaste}
              disabled={!repoRoot}
            />
          </div>

          {errors.length > 0 && (
            <div className="error-panel">
              <h3>Errors</h3>
              <ul>
                {errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {fileChanges.length > 0 && (
            <div className="changes-section">
              <FileList
                files={fileChanges}
                selectedFile={selectedFile}
                onSelect={setSelectedFile}
              />

              {selectedFile && (
                <Preview
                  file={selectedFile}
                  block={parsedBlocks.find((b) => b.file === selectedFile)}
                />
              )}
            </div>
          )}

          <ApplyControls
            isValid={isValid}
            canUndo={!!backupPath}
            onApply={handleApply}
            onUndo={handleUndo}
          />
        </main>
      </div>
    </div>
  );
}