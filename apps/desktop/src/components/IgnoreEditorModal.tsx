import React, { useEffect, useState } from 'react';
import { Modal } from './common';
import { Button } from '@/components/ui/button';
import { useAppStateContext, useRepositoryActions } from '@/hooks';

interface IgnoreEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IgnoreEditorModal({
  isOpen,
  onClose,
}: IgnoreEditorModalProps) {
  const { state, updateState } = useAppStateContext();
  const { handleSaveIgnore } = useRepositoryActions();
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const loadContent = async () => {
      if (!state.repoRoot) {
        setContent('');
        return;
      }

      try {
        setIsLoading(true);
        const result = await window.inscribeAPI.readIgnoreRaw(state.repoRoot);
        let fullContent = result.content || '';

        if (state.suggested.length > 0) {
          const suggestedSection = [
            '',
            '# --- Suggested (commented) ---',
            ...state.suggested.map((entry) => `# ${entry}`),
          ].join('\n');

          if (!fullContent.includes('# --- Suggested (commented) ---')) {
            fullContent = fullContent.trim() + suggestedSection + '\n';
          }
        }

        setContent(fullContent);
      } catch (error) {
        console.error('Failed to open ignore editor:', error);
        updateState({ statusMessage: 'Failed to open ignore editor' });
        setContent('');
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [isOpen, state.repoRoot, state.suggested, updateState]);

  const handleSave = async () => {
    if (!state.repoRoot) return;
    await handleSaveIgnore(content);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit .inscribeignore"
      size="large"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !state.repoRoot}>
            Save
          </Button>
        </>
      }
    >
      <p className="mb-4 text-muted-foreground text-sm leading-relaxed m-0">
        Edit the ignore rules. Each line should contain a folder or file pattern to exclude.
        Lines starting with # are comments.
      </p>
      {isLoading && <p className="text-muted-foreground text-sm mb-4">Loading current ignore rules...</p>}
      <textarea
        className="w-full min-h-[300px] p-3 border border-border rounded-md font-mono text-sm leading-relaxed resize-y bg-slate-900 text-slate-200"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="# Add ignore patterns here, one per line&#10;# Example:&#10;dist/&#10;build/"
        rows={20}
        disabled={isLoading}
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Supports literal prefixes, glob patterns (e.g., **/.*/), and optional regex: entries.
      </p>
    </Modal>
  );
}
