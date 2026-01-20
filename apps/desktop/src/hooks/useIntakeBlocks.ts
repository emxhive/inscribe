import { useMemo } from 'react';
import { parseIntakeStructure } from '@/utils/intake';
import { useAppStateContext } from './useAppStateContext';

export function useIntakeBlocks() {
  const { state } = useAppStateContext();

  return useMemo(() => {
    return parseIntakeStructure(state.aiInput, { indexedFileSet: state.indexedFileSet });
  }, [state.aiInput, state.indexedFileSet]);
}
