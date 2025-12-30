import React, { useState, useEffect } from 'react';

interface ScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  topLevelFolders: string[];
  currentScope: string[];
  onSave: (newScope: string[]) => void;
  disabled?: boolean;
}

export function ScopeModal({
  isOpen,
  onClose,
  topLevelFolders,
  currentScope,
  onSave,
  disabled = false,
}: ScopeModalProps) {
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set(currentScope));

  useEffect(() => {
    setSelectedFolders(new Set(currentScope));
  }, [currentScope, isOpen]);

  if (!isOpen) return null;

  const handleToggle = (folder: string) => {
    const newSelected = new Set(selectedFolders);
    if (newSelected.has(folder)) {
      newSelected.delete(folder);
    } else {
      newSelected.add(folder);
    }
    setSelectedFolders(newSelected);
  };

  const handleSave = () => {
    onSave(Array.from(selectedFolders).sort());
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Configure Scope</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p className="modal-description">
            Select the top-level folders to include in the scope. Only files within these folders
            will be indexed and available for modifications.
          </p>
          {topLevelFolders.length === 0 ? (
            <p className="empty-message">No top-level folders found in repository</p>
          ) : (
            <ul className="folder-list">
              {topLevelFolders.map((folder) => (
                <li key={folder} className="folder-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedFolders.has(folder)}
                      onChange={() => handleToggle(folder)}
                    />
                    <span>{folder}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="modal-footer">
          <button className="ghost-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-btn" onClick={handleSave} disabled={disabled}>
            Save Scope
          </button>
        </div>
      </div>
    </div>
  );
}
