import React, { useEffect, useState } from 'react';
import { Modal, Button } from './common';
import { useAppStateContext, useRepositoryActions } from '../hooks';

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

  useEffect(() => {
    const loadContent = async () => {
      if (!isOpen) return;
      if (!state.repoRoot) {
        setContent('');
        return;
      }

      try {
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
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save
          </Button>
        </>
      }
    >
      <p className="modal-description">
        Edit the ignore rules. Each line should contain a folder or file pattern to exclude.
        Lines starting with # are comments.
      </p>
      <textarea
        className="ignore-editor"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="# Add ignore patterns here, one per line&#10;# Example:&#10;dist/&#10;build/"
        rows={20}
      />
    </Modal>
  );
}
