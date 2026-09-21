import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { HistoryFileList } from '@/components/history/HistoryFileList';
import { IntakeBlockList } from '@/components/intake/IntakeBlockList';
import { ReviewFileList } from '@/components/review/ReviewFileList';
import { useAppStateContext } from '@/hooks';
import { cn } from '@/lib/utils';
import {
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
} from '@/utils/workspaceLayout';

type FileSidebarProps = {
  sidebarWidth: number;
  onResize: (
    width: number,
    options?: { persist?: boolean },
  ) => void;
};

export function FileSidebar({
  sidebarWidth,
  onResize,
}: FileSidebarProps) {
  const { state } =
    useAppStateContext();

  const [dragging, setDragging] =
    useState(false);

  const sidebarRef =
    useRef<HTMLElement | null>(null);

  const isHistoryReviewActive =
    Boolean(
      state.historyReview.actionId,
    );

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const handleMouseMove = (
      event: MouseEvent,
    ) => {
      if (!sidebarRef.current) {
        return;
      }

      const nextWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(
          MIN_SIDEBAR_WIDTH,
          event.clientX -
            sidebarRef.current
              .getBoundingClientRect()
              .left,
        ),
      );

      onResize(nextWidth);
    };

    const handleMouseUp = () => {
      setDragging(false);

      onResize(sidebarWidth, {
        persist: true,
      });
    };

    window.addEventListener(
      'mousemove',
      handleMouseMove,
    );

    window.addEventListener(
      'mouseup',
      handleMouseUp,
    );

    return () => {
      window.removeEventListener(
        'mousemove',
        handleMouseMove,
      );

      window.removeEventListener(
        'mouseup',
        handleMouseUp,
      );
    };
  }, [
    dragging,
    onResize,
    sidebarWidth,
  ]);

  return (
    <aside
      ref={sidebarRef}
      className="relative flex min-h-0 flex-col border-r border-border bg-card"
      style={{
        width: sidebarWidth,
      }}
    >
      {isHistoryReviewActive ? (
        <HistoryFileList />
      ) : state.mode === 'intake' ? (
        <IntakeBlockList />
      ) : (
        <ReviewFileList />
      )}

      <button
        type="button"
        aria-label="Resize sidebar"
        onMouseDown={() =>
          setDragging(true)
        }
        className={cn(
          'absolute right-0 top-0 h-full w-1.5 cursor-col-resize',
          dragging
            ? 'bg-primary/20'
            : 'hover:bg-border',
        )}
      />
    </aside>
  );
}