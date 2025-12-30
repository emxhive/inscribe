import React, { useState, useEffect } from 'react';

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

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(content);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit .inscribeignore</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
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
        </div>
        <div className="modal-footer">
          <button className="ghost-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-btn" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
