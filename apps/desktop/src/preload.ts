import { contextBridge, ipcRenderer } from 'electron';
import type {
  ApplyPlan,
  ApplyResult,
  ParseResult,
  Operation,
  ParsedBlock,
  ValidationError,
} from '@inscribe/shared';
import type {
  IgnoreWriteResult,
  ReadIgnoreRawResult,
  RepoInitResult,
} from './types';

const api = {
  selectRepository: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('select-repository', defaultPath),

  getLastVisitedRepo: (): Promise<string | null> =>
    ipcRenderer.invoke('repo-last-visited'),

  repoInit: (repoRoot: string): Promise<RepoInitResult> =>
    ipcRenderer.invoke('repo-init', repoRoot),

  openRepository: (repoRoot: string, target?: import('./types').OpenRepositoryTarget): Promise<void> =>
    ipcRenderer.invoke('open-repository', repoRoot, target),

  getRecentProjects: (): Promise<string[]> =>
    ipcRenderer.invoke('get-recent-projects'),

  getWindowRepo: (): Promise<string | null> =>
    ipcRenderer.invoke('get-window-repo'),

  getAppliedAiInput: (rawInput: string, repoRoot: string) =>
    ipcRenderer.invoke('applied-ai-input-get', rawInput, repoRoot),

  confirmPreviouslyAppliedAiInputParse: (record: import('@inscribe/shared').AppliedAiInputRecord): Promise<boolean> =>
    ipcRenderer.invoke('confirm-previously-applied-ai-input-parse', record),

  readClipboardText: (): Promise<string> =>
    ipcRenderer.invoke('clipboard-read-text'),

  selectMarkdownFile: (): Promise<{ path: string; content: string } | null> =>
    ipcRenderer.invoke('select-markdown-file'),

  onOpenRepo: (callback: (repoRoot: string) => void) => {
    const subscription = (_event: any, repoRoot: string) => callback(repoRoot);
    ipcRenderer.on('open-repo', subscription);
    return () => ipcRenderer.removeListener('open-repo', subscription);
  },

  onRecentProjectsUpdated: (callback: (projects: string[]) => void) => {
    const subscription = (_event: any, projects: string[]) => callback(projects);
    ipcRenderer.on('recent-projects-updated', subscription);
    return () => ipcRenderer.removeListener('recent-projects-updated', subscription);
  },

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

  validateBlocks: (blocks: ParsedBlock[]): Promise<ValidationError[]> =>
    ipcRenderer.invoke('validate-blocks', blocks),

  validateAndBuildApplyPlan: (blocks: ParsedBlock[]): Promise<ApplyPlan> =>
    ipcRenderer.invoke('validate-and-build-apply-plan', blocks),

  applyChanges: (plan: ApplyPlan, repoRoot: string, rawAiInput?: string): Promise<ApplyResult> =>
    ipcRenderer.invoke('apply-changes', plan, repoRoot, rawAiInput),

  restoreEntry: (request: import('@inscribe/engine').RestoreRequest, repoRoot: string): Promise<ApplyResult> =>
    ipcRenderer.invoke('restore-entry', request, repoRoot),

  compareOperation: (operation: Operation, repoRoot: string) =>
    ipcRenderer.invoke('compare-operation', operation, repoRoot),

  getHistoryEntries: (repoRoot: string) =>
    ipcRenderer.invoke('history-get', repoRoot),

  markHistoryEntryRestored: (repoRoot: string, entryId: string, restoredAt: string) =>
    ipcRenderer.invoke('history-mark-restored', repoRoot, entryId, restoredAt),

  previewV2Restore: (repoRoot: string, actionId: string) =>
    ipcRenderer.invoke('history-v2-preview-restore', repoRoot, actionId),

  restoreV2Action: (repoRoot: string, actionId: string): Promise<ApplyResult> =>
    ipcRenderer.invoke('history-v2-restore', repoRoot, actionId),

  terminalCreate: (options: import('./types').TerminalCreateOptions) =>
    ipcRenderer.invoke('terminal-create', options),

  terminalWrite: (sessionId: string, data: string) =>
    ipcRenderer.invoke('terminal-write', sessionId, data),

  terminalResize: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal-resize', sessionId, cols, rows),

  terminalDispose: (sessionId: string) =>
    ipcRenderer.invoke('terminal-dispose', sessionId),

  onTerminalData: (callback: (event: import('./types').TerminalDataEvent) => void) => {
    const subscription = (_event: any, payload: import('./types').TerminalDataEvent) => callback(payload);
    ipcRenderer.on('terminal:data', subscription);
    return () => ipcRenderer.removeListener('terminal:data', subscription);
  },

  onTerminalSessionExit: (callback: (event: import('./types').TerminalSessionExitEvent) => void) => {
    const subscription = (_event: any, payload: import('./types').TerminalSessionExitEvent) => callback(payload);
    ipcRenderer.on('terminal:session-exit', subscription);
    return () => ipcRenderer.removeListener('terminal:session-exit', subscription);
  },

  previewV2: (args: import('./ipc/previewV2Types').PreviewV2IpcArgs): Promise<import('./ipc/previewV2Types').PreviewV2WorkerResponse> =>
    ipcRenderer.invoke('preview-v2', args),

  applyV2: (args: import('./ipc/applyV2Types').ApplyV2IpcArgs): Promise<import('./ipc/applyV2Types').ApplyV2WorkerResponse> =>
    ipcRenderer.invoke('apply-v2', args),
};

contextBridge.exposeInMainWorld('inscribeAPI', api);
