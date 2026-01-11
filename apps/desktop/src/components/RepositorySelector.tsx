import React, { useState } from 'react';

interface RepositorySelectorProps {
  selectedPath: string;
  onSelect: (path: string) => void;
  indexedRoots: readonly string[];
  indexedFilesCount: number;
}

export default function RepositorySelector({
  selectedPath,
  onSelect,
  indexedRoots,
  indexedFilesCount,
}: RepositorySelectorProps) {
  const [input, setInput] = useState(selectedPath);

  const handleSelect = async () => {
    try {
      const path = await window.inscribeAPI.selectRepository(input);
      if (path) {
        setInput(path);
        onSelect(path);
      }
    } catch (err) {
      console.error('Failed to select repository:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSelect();
    }
  };

  return (
    <div className="repository-selector">
      <h3>Repository Root</h3>
      <input
        type="text"
        value={input}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        placeholder="Enter repo root path or click Browse"
        readOnly={false}
      />
      <button onClick={handleSelect}>Browse</button>
      {selectedPath && <p className="selected">✓ {selectedPath}</p>}

      <div className="indexed-summary">
        <h4>Indexed roots</h4>
        <ul>
          {indexedRoots.map((root) => (
            <li key={root}>{root}</li>
          ))}
        </ul>
        <p>Total indexed files: {indexedFilesCount}</p>
      </div>
    </div>
  );
}
