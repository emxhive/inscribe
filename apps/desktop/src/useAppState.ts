import { useState, useCallback } from 'react';
import type { ParsedBlock, ValidationError } from '@inscribe/shared';

export type Mode = 'intake' | 'review';
export type IndexState = 'idle' | 'running' | 'complete' | 'error';

export interface IndexStatus {
  state: IndexState;
  message?: string;
}

export interface IgnoreRules {
  entries: string[];
  source: 'file' | 'none';
  path: string;
}

export interface ReviewItem {
  id: string;
  file: string;
  mode: string;
  language: string;
  lineCount: number;
  status: 'valid' | 'warning' | 'invalid';
  originalContent: string;
  editedContent: string;
  validationError?: string;
  blockIndex: number;
  directives: Record<string, string>;
}

export interface AppState {
  // Repository state
  repoRoot: string | null;
  topLevelFolders: string[];
  scope: string[];
  ignore: IgnoreRules;
  suggested: string[];
  indexedCount: number;
  indexStatus: IndexStatus;

  // Parsing/Review state
  mode: Mode;
  aiInput: string;
  parseErrors: string[];
  parsedBlocks: ParsedBlock[];
  validationErrors: ValidationError[];
  reviewItems: ReviewItem[];
  selectedItemId: string | null;

  // UI state
  isEditing: boolean;
  statusMessage: string;

  // Apply/Undo/Redo state
  lastAppliedPlan: any | null;
  canRedo: boolean;
}

export const initialState: AppState = {
  repoRoot: null,
  topLevelFolders: [],
  scope: [],
  ignore: { entries: [], source: 'none', path: '' },
  suggested: [],
  indexedCount: 0,
  indexStatus: { state: 'idle' },

  mode: 'intake',
  aiInput: '',
  parseErrors: [],
  parsedBlocks: [],
  validationErrors: [],
  reviewItems: [],
  selectedItemId: null,

  isEditing: false,
  statusMessage: 'Ready',

  lastAppliedPlan: null,
  canRedo: false,
};

export function useAppState() {
  const [state, setState] = useState<AppState>(initialState);

  const updateState = useCallback((updates: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const setRepoRoot = useCallback((repoRoot: string | null) => {
    setState((prev) => ({ ...prev, repoRoot }));
  }, []);

  const setTopLevelFolders = useCallback((topLevelFolders: string[]) => {
    setState((prev) => ({ ...prev, topLevelFolders }));
  }, []);

  const setScope = useCallback((scope: string[]) => {
    setState((prev) => ({ ...prev, scope }));
  }, []);

  const setIgnore = useCallback((ignore: IgnoreRules) => {
    setState((prev) => ({ ...prev, ignore }));
  }, []);

  const setSuggested = useCallback((suggested: string[]) => {
    setState((prev) => ({ ...prev, suggested }));
  }, []);

  const setIndexedCount = useCallback((indexedCount: number) => {
    setState((prev) => ({ ...prev, indexedCount }));
  }, []);

  const setIndexStatus = useCallback((indexStatus: IndexStatus) => {
    setState((prev) => ({ ...prev, indexStatus }));
  }, []);

  const setMode = useCallback((mode: Mode) => {
    setState((prev) => ({ ...prev, mode }));
  }, []);

  const setAiInput = useCallback((aiInput: string) => {
    setState((prev) => ({ ...prev, aiInput }));
  }, []);

  const setParseErrors = useCallback((parseErrors: string[]) => {
    setState((prev) => ({ ...prev, parseErrors }));
  }, []);

  const setParsedBlocks = useCallback((parsedBlocks: ParsedBlock[]) => {
    setState((prev) => ({ ...prev, parsedBlocks }));
  }, []);

  const setValidationErrors = useCallback((validationErrors: ValidationError[]) => {
    setState((prev) => ({ ...prev, validationErrors }));
  }, []);

  const setReviewItems = useCallback((reviewItems: ReviewItem[]) => {
    setState((prev) => ({ ...prev, reviewItems }));
  }, []);

  const setSelectedItemId = useCallback((selectedItemId: string | null) => {
    setState((prev) => ({ ...prev, selectedItemId }));
  }, []);

  const setIsEditing = useCallback((isEditing: boolean) => {
    setState((prev) => ({ ...prev, isEditing }));
  }, []);

  const setStatusMessage = useCallback((statusMessage: string) => {
    setState((prev) => ({ ...prev, statusMessage }));
  }, []);

  const updateReviewItemContent = useCallback((id: string, editedContent: string) => {
    setState((prev) => ({
      ...prev,
      reviewItems: prev.reviewItems.map((item) =>
        item.id === id ? { ...item, editedContent } : item
      ),
    }));
  }, []);

  const setLastAppliedPlan = useCallback((plan: any | null) => {
    setState((prev) => ({ ...prev, lastAppliedPlan: plan, canRedo: plan !== null }));
  }, []);

  const clearRedo = useCallback(() => {
    setState((prev) => ({ ...prev, lastAppliedPlan: null, canRedo: false }));
  }, []);

  return {
    state,
    updateState,
    setRepoRoot,
    setTopLevelFolders,
    setScope,
    setIgnore,
    setSuggested,
    setIndexedCount,
    setIndexStatus,
    setMode,
    setAiInput,
    setParseErrors,
    setParsedBlocks,
    setValidationErrors,
    setReviewItems,
    setSelectedItemId,
    setIsEditing,
    setStatusMessage,
    updateReviewItemContent,
    setLastAppliedPlan,
    clearRedo,
  };
}
