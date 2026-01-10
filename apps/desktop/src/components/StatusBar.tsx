import React from 'react';
import { 
  Breadcrumb, 
  BreadcrumbList, 
  BreadcrumbItem, 
  BreadcrumbLink, 
  BreadcrumbPage, 
  BreadcrumbSeparator 
} from '@/components/ui/breadcrumb';
import { useAppStateContext } from '@/hooks';

type Stage = 'parse' | 'review';

export function StatusBar() {
  const { state, updateState } = useAppStateContext();
  const currentStage: Stage = state.mode === 'intake' ? 'parse' : 'review';

  const handleNavigateToMode = (targetMode: 'parse' | 'review') => {
    if (targetMode === 'parse') {
      updateState({ mode: 'intake', pipelineStatus: 'idle' });
    } else if (targetMode === 'review') {
      updateState({ mode: 'review' });
    }
  };

  const stages: { id: Stage; label: string }[] = [
    { id: 'parse', label: 'Parse' },
    { id: 'review', label: 'Review' },
  ];

  const currentIndex = stages.findIndex((s) => s.id === currentStage);

  return (
    <footer className="flex items-center px-4 py-2 border-t bg-card text-card-foreground">
      <Breadcrumb>
        <BreadcrumbList>
          {stages.map((stage, index) => {
            const isActive = stage.id === currentStage;
            const isCompleted = index < currentIndex;
            const isClickable = isCompleted;

            return (
              <React.Fragment key={stage.id}>
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {isActive ? (
                    <BreadcrumbPage className="font-semibold">
                      {stage.label}
                    </BreadcrumbPage>
                  ) : isClickable ? (
                    <BreadcrumbLink
                      onClick={() => handleNavigateToMode(stage.id)}
                      className="cursor-pointer"
                    >
                      {stage.label}
                    </BreadcrumbLink>
                  ) : (
                    <span className="text-muted-foreground cursor-not-allowed opacity-50">
                      {stage.label}
                    </span>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </footer>
  );
}
