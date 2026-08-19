import { useMemo } from 'react';
import { attributeV2PreviewDiagnostics, parseLiveIntakeStructure } from '@/utils';
import { useAppStateContext } from './useAppStateContext';

export function useIntakeBlocks() {
  const { state } = useAppStateContext();

  return useMemo(() => {
    const structure = parseLiveIntakeStructure(state.aiInput, { indexedFileSet: state.indexedFileSet });
    return attributeV2PreviewDiagnostics(structure, state.v2PreviewDiagnostics);
  }, [state.aiInput, state.indexedFileSet, state.v2PreviewDiagnostics]);
}
