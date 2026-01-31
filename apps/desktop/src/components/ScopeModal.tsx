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
          {state.topLevelFolders.map((folder) => {
            const inputId = `scope-folder-${folder.replace(/[^a-z0-9_-]+/gi, '-')}`;
            const isIgnored = ignoredTopLevelFolders.has(folder);
            return (
              <li key={folder} className="flex items-start gap-2 mb-2">
                <input
                  id={inputId}
                  type="checkbox"
                  className={`mt-1 h-3.5 w-3.5 ${isIgnored ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  checked={selectedFolders.has(folder)}
                  disabled={isIgnored}
                  onChange={() => handleToggle(folder)}
                />
                <label
                  htmlFor={inputId}
                  className={`text-sm ${isIgnored ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer'}`}
                >
                  <span className="inline-code border border-border/40 bg-muted/40 px-2 py-0.5 rounded-md">
                    {folder}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
