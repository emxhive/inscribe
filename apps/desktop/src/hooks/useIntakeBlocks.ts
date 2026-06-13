import { useMemo } from 'react';
import { parseLiveIntakeStructure } from '@/utils';
import { useAppStateContext } from './useAppStateContext';

export function useIntakeBlocks() {
  const { state } = useAppStateContext();

  return useMemo(() => {
    return parseLiveIntakeStructure(state.aiInput, { indexedFileSet: state.indexedFileSet });
  }, [state.aiInput, state.indexedFileSet]);
}
