import type { AppState } from '@/types';

export function applyAppStateUpdates(
  prev: AppState,
  updates: Partial<AppState>,
): AppState {
  return {
    ...prev,
    ...updates,
  };
}