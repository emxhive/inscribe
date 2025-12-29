import React from 'react';

interface PasteAreaProps {
  content: string;
  onChange: (content: string) => void;
  disabled: boolean;
}

export default function PasteArea({ content, onChange, disabled }: PasteAreaProps) {
  return (
    <div className="paste-area">
      <h3>Paste AI Response</h3>
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Paste entire AI response here. Inscribe blocks will be parsed automatically."
        rows={12}
      />
      <p className="hint">Only @inscribe blocks are processed. Other text is ignored.</p>
    </div>
  );
}