import React, { createContext, ReactNode, useContext } from 'react';
import { useAppState } from './useAppState';

const AppStateContext = createContext<ReturnType<typeof useAppState> | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const value = useAppState();
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppStateContext() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppStateContext must be used within an AppStateProvider');
  }
  return context;
}
