import React from 'react';

interface ApplyControlsProps {
  isValid: boolean;
  canUndo: boolean;
  onApply: () => void;
  onUndo: () => void;
}

export default function ApplyControls({
  isValid,
  canUndo,
  onApply,
  onUndo,
}: ApplyControlsProps) {
  return (
    <div className="apply-controls">
      <button
        className="apply-btn"
        onClick={onApply}
        disabled={!isValid}
        title={isValid ? 'Apply all changes' : 'Fix errors to enable apply'}
      >
        Apply Changes
      </button>
      <button
        className="undo-btn"
        onClick={onUndo}
        disabled={!canUndo}
        title={canUndo ? 'Undo last apply' : 'No backup to restore'}
      >
        Undo Last Apply
      </button>
    </div>
  );
}