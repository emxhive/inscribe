import { contextBridge, ipcRenderer } from 'electron';
import type { ApplyPlan, ValidationError } from '@inscribe/shared';

const api = {
  selectRepository: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('select-repository', defaultPath),

  repoInit: (repoRoot: string): Promise<any> =>
    ipcRenderer.invoke('repo-init', repoRoot),

  getScope: (repoRoot: string): Promise<string[]> =>
    ipcRenderer.invoke('get-scope', repoRoot),

  setScope: (repoRoot: string, scope: string[]): Promise<any> =>
    ipcRenderer.invoke('set-scope', repoRoot, scope),

  readIgnore: (repoRoot: string): Promise<any> =>
    ipcRenderer.invoke('read-ignore', repoRoot),

  readIgnoreRaw: (repoRoot: string): Promise<{ content: string; path: string; exists: boolean }> =>
    ipcRenderer.invoke('read-ignore-raw', repoRoot),

  writeIgnore: (repoRoot: string, content: string): Promise<any> =>
    ipcRenderer.invoke('write-ignore', repoRoot, content),

  indexRepository: (repoRoot: string): Promise<any> =>
    ipcRenderer.invoke('index-repository', repoRoot),

  indexStatus: (repoRoot: string): Promise<any> =>
    ipcRenderer.invoke('index-status', repoRoot),

  parseBlocks: (content: string): Promise<any> =>
    ipcRenderer.invoke('parse-blocks', content),

  validateBlocks: (blocks: any[], repoRoot: string): Promise<ValidationError[]> =>
    ipcRenderer.invoke('validate-blocks', blocks, repoRoot),

  validateAndBuildApplyPlan: (blocks: any[], repoRoot: string): Promise<ApplyPlan | ValidationError[]> =>
    ipcRenderer.invoke('validate-and-build-apply-plan', blocks, repoRoot),

  applyChanges: (plan: ApplyPlan, repoRoot: string): Promise<{ success: boolean; backupPath?: string; errors?: string[] }> =>
    ipcRenderer.invoke('apply-changes', plan, repoRoot),

  undoLastApply: (repoRoot: string): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke('undo-last-apply', repoRoot),
};

contextBridge.exposeInMainWorld('inscribeAPI', api);
