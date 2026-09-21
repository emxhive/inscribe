import { useCallback } from 'react';
import { getPathBasename } from '@/utils';
import { buildIntakeReplacementUpdate } from '@/state/workflowTransitions';
import { useAppStateContext } from './useAppStateContext';

export function useIntakeImportActions() {
  const { updateState } = useAppStateContext();

  const replaceIntakeFromClipboard = useCallback(async () => {
    try {
      const clipboardText = await window.inscribeAPI.readClipboardText();

      if (!clipboardText.trim()) {
        updateState({
          mode: 'intake',
          statusMessage: 'Clipboard is empty.',
        });
        return;
      }

      replaceIntake(
        updateState,
        clipboardText,
        `Replaced intake with ${clipboardText.length} clipboard character${clipboardText.length === 1 ? '' : 's'}.`,
      );
    } catch (error) {
      updateState({
        mode: 'intake',
        statusMessage: `Unable to read clipboard: ${error}`,
      });
    }
  }, [updateState]);

  const uploadIntake = useCallback(async () => {
    try {
      const selectedFile = await window.inscribeAPI.selectMarkdownFile();
      if (!selectedFile) return;

      if (!selectedFile.content.trim()) {
        updateState({
          mode: 'intake',
          statusMessage: 'Selected Markdown document is empty.',
        });
        return;
      }

      replaceIntake(
        updateState,
        selectedFile.content,
        `Loaded ${getPathBasename(selectedFile.path)} into intake.`,
      );
    } catch (error) {
      updateState({
        mode: 'intake',
        statusMessage: `Unable to upload Markdown document: ${error}`,
      });
    }
  }, [updateState]);

  return {
    replaceIntakeFromClipboard,
    uploadIntake,
  };
}

function replaceIntake(
  updateState: ReturnType<typeof useAppStateContext>['updateState'],
  content: string,
  statusMessage: string,
) {
  updateState(
    buildIntakeReplacementUpdate(
      content,
      statusMessage,
    ),
  );
}