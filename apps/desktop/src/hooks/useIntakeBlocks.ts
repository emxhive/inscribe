import { useMemo } from 'react';
import { attributePreviewDiagnostics, parseLiveIntakeStructure } from '@/utils';
import { useAppStateContext } from './useAppStateContext';

export function useIntakeBlocks() {
  const { state } = useAppStateContext();

  return useMemo(() => {
    const structure = parseLiveIntakeStructure(state.aiInput, { indexedFileSet: state.indexedFileSet });
    return attributePreviewDiagnostics(structure, state.previewDiagnostics);
  }, [state.aiInput, state.indexedFileSet, state.previewDiagnostics]);
}
