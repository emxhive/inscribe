import React, { useState, useEffect } from 'react';
import { Modal, Button } from './common';
import { useAppStateContext, useRepositoryActions } from '../hooks';

interface ScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ScopeModal({
  isOpen,
  onClose,
}: ScopeModalProps) {
  const { state } = useAppStateContext();
  const { handleSaveScope } = useRepositoryActions();
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set(state.scope));

  useEffect(() => {
    setSelectedFolders(new Set(state.scope));
  }, [state.scope, isOpen]);

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
    handleSaveScope(Array.from(selectedFolders).sort());
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
          <Button variant="primary" onClick={handleSave} disabled={!state.repoRoot}>
            Save Scope
          </Button>
        </>
      }
    >
      <p className="modal-description">
        Select the top-level folders to include in the scope. Only files within these folders
        will be indexed and available for modifications.
      </p>
      {state.topLevelFolders.length === 0 ? (
        <p className="empty-message">No top-level folders found in repository</p>
      ) : (
        <ul className="folder-list">
          {state.topLevelFolders.map((folder) => (
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
