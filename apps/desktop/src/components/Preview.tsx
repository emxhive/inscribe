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

  const isTextMode = ['replace_line', 'replace_range', 'replace_between', 'replace_block'].includes(block.mode);

  return (
    <div className="preview">
      <h4>
        Preview: <span className="inline-code">{file}</span>
      </h4>
      <div className="preview-info">
        <p>
          <strong>Mode:</strong> {block.mode}
        </p>
        {isTextMode && (
          <>
            {block.directives.START && (
              <p>
                <strong>START:</strong> {block.directives.START}
              </p>
            )}
            {block.directives.END && (
              <p>
                <strong>END:</strong> {block.directives.END}
              </p>
            )}
          </>
        )}
      </div>
      <div className="preview-content">
        <pre>{block.content}</pre>
      </div>
    </div>
  );
}
