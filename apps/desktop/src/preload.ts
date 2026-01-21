import { contextBridge, ipcRenderer } from 'electron';
import type {
  ApplyPlan,
  ApplyResult,
  ParseResult,
  Operation,
  ParsedBlock,
  UndoResult,
  ValidationError,
} from '@inscribe/shared';
import type {
  IgnoreWriteResult,
  ReadIgnoreRawResult,
  RepoInitResult,
  ScopeUpdateResult,
} from './types';

const api = {
  selectRepository: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('select-repository', defaultPath),

  getLastVisitedRepo: (): Promise<string | null> =>
    ipcRenderer.invoke('repo-last-visited'),

  repoInit: (repoRoot: string): Promise<RepoInitResult> =>
    ipcRenderer.invoke('repo-init', repoRoot),

  getScope: (repoRoot: string): Promise<string[]> =>
    ipcRenderer.invoke('get-scope', repoRoot),

  setScope: (repoRoot: string, scope: string[]): Promise<ScopeUpdateResult> =>
    ipcRenderer.invoke('set-scope', repoRoot, scope),

  readIgnore: (repoRoot: string): Promise<RepoInitResult['ignore']> =>
    ipcRenderer.invoke('read-ignore', repoRoot),

  readIgnoreRaw: (repoRoot: string): Promise<ReadIgnoreRawResult> =>
    ipcRenderer.invoke('read-ignore-raw', repoRoot),

  writeIgnore: (repoRoot: string, content: string): Promise<IgnoreWriteResult> =>
    ipcRenderer.invoke('write-ignore', repoRoot, content),

  indexRepository: (repoRoot: string): Promise<string[]> =>
    ipcRenderer.invoke('index-repository', repoRoot),

  indexStatus: (repoRoot: string): Promise<RepoInitResult['indexStatus']> =>
    ipcRenderer.invoke('index-status', repoRoot),

  parseBlocks: (content: string): Promise<ParseResult> =>
    ipcRenderer.invoke('parse-blocks', content),

  validateBlocks: (blocks: ParsedBlock[], repoRoot: string): Promise<ValidationError[]> =>
    ipcRenderer.invoke('validate-blocks', blocks, repoRoot),

  validateAndBuildApplyPlan: (blocks: ParsedBlock[], repoRoot: string): Promise<ApplyPlan> =>
    ipcRenderer.invoke('validate-and-build-apply-plan', blocks, repoRoot),

  applyChanges: (plan: ApplyPlan, repoRoot: string): Promise<ApplyResult> =>
    ipcRenderer.invoke('apply-changes', plan, repoRoot),

  previewOperation: (operation: Operation, repoRoot: string) =>
    ipcRenderer.invoke('preview-operation', operation, repoRoot),

  undoLastApply: (repoRoot: string): Promise<UndoResult> =>
    ipcRenderer.invoke('undo-last-apply', repoRoot),
};

contextBridge.exposeInMainWorld('inscribeAPI', api);
