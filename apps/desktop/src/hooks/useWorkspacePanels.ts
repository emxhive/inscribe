import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStateContext } from '@/hooks';
import { MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH } from '@/components/workspace/FileSidebar';

const RIGHT_PANEL_WIDTH = 360;

const PANEL_STORAGE_KEYS = {
  leftCollapsed: 'inscribe:ui:leftCollapsed',
  rightCollapsed: 'inscribe:ui:rightCollapsed',
  leftWidth: 'inscribe:ui:leftPanelWidth',
} as const;

export function useWorkspacePanels() {
  const { state, updateState } = useAppStateContext();
  const panelPersistenceReady = useRef(false);

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === 'undefined') return 280;

    const stored = window.localStorage.getItem(PANEL_STORAGE_KEYS.leftWidth);
    const parsed = stored ? Number(stored) : 280;

    if (!Number.isFinite(parsed)) return 280;

    return Math.min(
      MAX_SIDEBAR_WIDTH,
      Math.max(MIN_SIDEBAR_WIDTH, parsed),
    );
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const leftCollapsed =
      window.localStorage.getItem(PANEL_STORAGE_KEYS.leftCollapsed) === 'true';
    const rightCollapsed =
      window.localStorage.getItem(PANEL_STORAGE_KEYS.rightCollapsed) === 'true';

    updateState({
      isLeftPanelCollapsed: leftCollapsed,
      isRightPanelCollapsed: rightCollapsed,
    });

    panelPersistenceReady.current = true;
  }, [updateState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!panelPersistenceReady.current) return;

    window.localStorage.setItem(
      PANEL_STORAGE_KEYS.leftCollapsed,
      String(state.isLeftPanelCollapsed),
    );
    window.localStorage.setItem(
      PANEL_STORAGE_KEYS.rightCollapsed,
      String(state.isRightPanelCollapsed),
    );
  }, [state.isLeftPanelCollapsed, state.isRightPanelCollapsed]);

  const handleSidebarResize = useCallback((
    width: number,
    options?: { persist?: boolean },
  ) => {
    const clamped = Math.min(
      MAX_SIDEBAR_WIDTH,
      Math.max(MIN_SIDEBAR_WIDTH, width),
    );

    setSidebarWidth(clamped);

    if (options?.persist && typeof window !== 'undefined') {
      window.localStorage.setItem(
        PANEL_STORAGE_KEYS.leftWidth,
        String(clamped),
      );
    }
  }, []);

  const toggleHistory = useCallback(() => {
    updateState((prev) => ({
      rightPanelOwner: 'history',
      isRightPanelCollapsed:
        prev.rightPanelOwner === 'history' && !prev.isRightPanelCollapsed,
    }));
  }, [updateState]);

  const workspaceColumns = [
    !state.isLeftPanelCollapsed ? `${sidebarWidth}px` : null,
    'minmax(0,1fr)',
    !state.isRightPanelCollapsed ? `${RIGHT_PANEL_WIDTH}px` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    sidebarWidth,
    handleSidebarResize,
    workspaceColumns,
    toggleHistory,
  };
}