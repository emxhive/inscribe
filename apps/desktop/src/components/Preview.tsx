import React from 'react';

interface Block {
  file: string;
  mode: string;
  directives: Record<string, string>;
  content: string;
}

interface PreviewProps {
  file: string;
  block?: Block;
}

export default function Preview({ file, block }: PreviewProps) {
  if (!block) {
    return <div className="preview">No preview available</div>;
  }

  return (
    <div className="preview">
      <h4>Preview: {file}</h4>
      <div className="preview-info">
        <p>
          <strong>Mode:</strong> {block.mode}
        </p>
        {block.mode === 'range' && (
          <>
            <p>
              <strong>START:</strong> {block.directives.START || 'N/A'}
            </p>
            <p>
              <strong>END:</strong> {block.directives.END || 'N/A'}
            </p>
          </>
        )}
      </div>
      <div className="preview-content">
        <pre>{block.content}</pre>
      </div>
    </div>
  );
}