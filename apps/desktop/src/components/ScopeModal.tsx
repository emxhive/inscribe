import React, { useState, useEffect } from 'react';
import { Modal } from './common';
import { Button } from '@/components/ui/button';
import { useAppStateContext, useRepositoryActions } from '@/hooks';

interface ScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const normalizePrefix = (input: string) => {
  const trimmed = input.trim().replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+/g, '/');
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
};

export function ScopeModal({
  isOpen,
  onClose,
}: ScopeModalProps) {
  const { state } = useAppStateContext();
  const { handleSaveScope } = useRepositoryActions();
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set(state.scope));
  const defaultIgnoreEntries = [
    (state as { defaultIgnoreEntries?: string[] }).defaultIgnoreEntries,
    (state as { defaultIgnores?: string[] }).defaultIgnores,
  ].find((entries): entries is string[] => Array.isArray(entries)) ?? [];
  const ignoreEntries = [...state.ignore.entries, ...defaultIgnoreEntries].map(normalizePrefix);
  const ignoredTopLevelFolders = new Set(
    state.topLevelFolders.filter((folder) => ignoreEntries.includes(normalizePrefix(folder)))
  );

  useEffect(() => {
    setSelectedFolders(new Set(state.scope));
  }, [state.scope, isOpen]);

  const handleToggle = (folder: string) => {
    if (ignoredTopLevelFolders.has(folder)) {
      return;
    }
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
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!state.repoRoot}>
            Save Scope
          </Button>
        </>
      }
    >
      <p className="mb-4 text-muted-foreground text-sm leading-relaxed m-0">
        Select the top-level folders to include in the scope. Root-level files and files within
        these folders will be indexed (excluding ignored paths).
      </p>
      {state.topLevelFolders.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">No top-level folders found in repository</p>
      ) : (
        <ul className="list-none p-0 m-0">
          {state.topLevelFolders.map((folder) => (
            <li key={folder} className="p-3 border border-border rounded-md mb-2 bg-secondary">
              <label
                className={`flex items-center gap-3 text-sm ${
                  ignoredTopLevelFolders.has(folder)
                    ? 'cursor-not-allowed text-muted-foreground'
                    : 'cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  className={`w-4 h-4 ${ignoredTopLevelFolders.has(folder) ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  checked={selectedFolders.has(folder)}
                  disabled={ignoredTopLevelFolders.has(folder)}
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
