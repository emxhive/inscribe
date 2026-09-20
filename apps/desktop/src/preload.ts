import { contextBridge, ipcRenderer } from 'electron';
import type { ApplyResult } from '@inscribe/shared';
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

  getHistoryEntries: (repoRoot: string) =>
    ipcRenderer.invoke('history-get', repoRoot),

  previewRestore: (repoRoot: string, actionId: string) =>
    ipcRenderer.invoke('history-preview-restore', repoRoot, actionId),

  restoreAction: (repoRoot: string, actionId: string): Promise<ApplyResult> =>
    ipcRenderer.invoke('history-restore', repoRoot, actionId),

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

  preview: (args: import('./ipc/previewTypes').PreviewIpcArgs): Promise<import('./ipc/previewTypes').PreviewWorkerResponse> =>
    ipcRenderer.invoke('preview', args),

  apply: (args: import('./ipc/applyTypes').ApplyIpcArgs): Promise<import('./ipc/applyTypes').ApplyWorkerResponse> =>
    ipcRenderer.invoke('apply', args),
};

contextBridge.exposeInMainWorld('inscribeAPI', api);
