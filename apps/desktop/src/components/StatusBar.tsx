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
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toSentenceCase } from '@/utils';

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

  // Determine status display
  const statusIcon = (() => {
    switch (state.pipelineStatus) {
      case 'parsing':
      case 'applying':
        return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
      case 'parse-success':
      case 'apply-success':
        return <CheckCircle2 className="h-3.5 w-3.5" />;
      case 'parse-failure':
      case 'apply-failure':
        return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
      default:
        if (state.indexStatus.state === 'error') {
          return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
        }
        return null;
    }
  })();

  const statusText = (() => {
    switch (state.pipelineStatus) {
      case 'parsing':
        return 'Parsing...';
      case 'parse-success':
        return 'Parse Success';
      case 'parse-failure':
        return 'Parse Failed';
      case 'applying':
        return 'Applying...';
      case 'apply-success':
        return 'Apply Success';
      case 'apply-failure':
        return 'Apply Failed';
      default:
        return toSentenceCase(state.indexStatus.state);
    }
  })();

  return (
    <footer className="flex items-center justify-between px-4 py-2 border-t bg-card text-card-foreground flex-shrink-0">
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
      
      {/* Status indicator on the right */}
      {(statusText || statusIcon) && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {statusIcon}
          <span>{statusText}</span>
        </div>
      )}
    </footer>
  );
}
