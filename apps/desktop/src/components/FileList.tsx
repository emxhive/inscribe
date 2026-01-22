import React from 'react';

interface FileChange {
  file: string;
  status: 'new' | 'modified' | 'error';
  error?: string;
}

interface FileListProps {
  files: FileChange[];
  selectedFile: string;
  onSelect: (file: string) => void;
}

export default function FileList({ files, selectedFile, onSelect }: FileListProps) {
  return (
    <div className="file-list">
      <h3>Files to Change ({files.length})</h3>
      <ul>
        {files.map((file) => (
          <li
            key={file.file}
            className={`file-item ${file.status} ${
              selectedFile === file.file ? 'selected' : ''
            }`}
            onClick={() => onSelect(file.file)}
          >
            <span className="status">{file.status}</span>
            <span className="filename inline-code">{file.file}</span>
            {file.error && <span className="error">{file.error}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
