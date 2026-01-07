import React, { useState, useEffect } from 'react';
import { Modal, Button } from './common';

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configure Scope"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={disabled}>
            Save Scope
          </Button>
        </>
      }
    >
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
    </Modal>
  );
}
