import React from 'react';

type Stage = 'parse' | 'review';

interface BreadcrumbProps {
  currentStage: Stage;
  onNavigate: (stage: Stage) => void;
}

export function Breadcrumb({ currentStage, onNavigate }: BreadcrumbProps) {
  const stages: { id: Stage; label: string }[] = [
    { id: 'parse', label: 'Parse' },
    { id: 'review', label: 'Review' },
  ];

  const currentIndex = stages.findIndex((s) => s.id === currentStage);

  return (
    <div className="breadcrumb">
      {stages.map((stage, index) => {
        const isActive = stage.id === currentStage;
        const isCompleted = index < currentIndex;
        const isClickable = isCompleted;

        return (
          <React.Fragment key={stage.id}>
            {index > 0 && <span className="breadcrumb-separator">›</span>}
            <button
              type="button"
              className={`breadcrumb-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${!isClickable ? 'disabled' : ''}`}
              onClick={() => isClickable && onNavigate(stage.id)}
              disabled={!isClickable}
            >
              {stage.label}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
