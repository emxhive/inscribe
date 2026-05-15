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
  ScopeUpdateResult,
} from './types';

const api = {
  selectRepository: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('select-repository', defaultPath),

  getLastVisitedRepo: (): Promise<string | null> =>
    ipcRenderer.invoke('repo-last-visited'),

  repoInit: (repoRoot: string): Promise<RepoInitResult> =>
    ipcRenderer.invoke('repo-init', repoRoot),

  openRepository: (repoRoot: string): Promise<void> =>
    ipcRenderer.invoke('open-repository', repoRoot),

  getRecentProjects: (): Promise<string[]> =>
    ipcRenderer.invoke('get-recent-projects'),

  getWindowRepo: (): Promise<string | null> =>
    ipcRenderer.invoke('get-window-repo'),

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

  compareOperation: (operation: Operation, repoRoot: string) =>
    ipcRenderer.invoke('compare-operation', operation, repoRoot),

  getHistoryEntries: (repoRoot: string) =>
    ipcRenderer.invoke('history-get', repoRoot),

  markHistoryEntryRestored: (repoRoot: string, entryId: string, restoredAt: string) =>
    ipcRenderer.invoke('history-mark-restored', repoRoot, entryId, restoredAt),

  terminalCreate: (options: import('./types').TerminalCreateOptions) =>
    ipcRenderer.invoke('terminal-create', options),

  terminalRunCommand: (sessionId: string, runId: string, command: string) =>
    ipcRenderer.invoke('terminal-run-command', sessionId, runId, command),

  terminalResize: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal-resize', sessionId, cols, rows),

  terminalInterrupt: (sessionId: string) =>
    ipcRenderer.invoke('terminal-interrupt', sessionId),

  terminalDispose: (sessionId: string) =>
    ipcRenderer.invoke('terminal-dispose', sessionId),

  onTerminalData: (callback: (event: import('./types').TerminalDataEvent) => void) => {
    const subscription = (_event: any, payload: import('./types').TerminalDataEvent) => callback(payload);
    ipcRenderer.on('terminal:data', subscription);
    return () => ipcRenderer.removeListener('terminal:data', subscription);
  },

  onTerminalRunExit: (callback: (event: import('./types').TerminalRunExitEvent) => void) => {
    const subscription = (_event: any, payload: import('./types').TerminalRunExitEvent) => callback(payload);
    ipcRenderer.on('terminal:run-exit', subscription);
    return () => ipcRenderer.removeListener('terminal:run-exit', subscription);
  },

};

contextBridge.exposeInMainWorld('inscribeAPI', api);
