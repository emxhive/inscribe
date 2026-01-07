import React, { useState, useEffect } from 'react';
import { Modal, Button } from './common';

interface IgnoreEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentContent: string;
  suggested: string[];
  onSave: (content: string) => void;
}

export function IgnoreEditorModal({
  isOpen,
  onClose,
  currentContent,
  suggested,
  onSave,
}: IgnoreEditorModalProps) {
  const [content, setContent] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      // Build content with suggested entries commented out
      let fullContent = currentContent;
      
      // Add suggested section if there are suggestions
      if (suggested.length > 0) {
        const suggestedSection = [
          '',
          '# --- Suggested (commented) ---',
          ...suggested.map((entry) => `# ${entry}`),
        ].join('\n');
        
        // Only add if not already present
        if (!fullContent.includes('# --- Suggested (commented) ---')) {
          fullContent = fullContent.trim() + suggestedSection + '\n';
        }
      }
      
      setContent(fullContent);
    }
  }, [isOpen, currentContent, suggested]);

  const handleSave = () => {
    onSave(content);
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
