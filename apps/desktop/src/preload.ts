import { contextBridge, ipcRenderer } from 'electron';
import type { ApplyPlan, ValidationError } from '@inscribe/shared';

const api = {
  selectRepository: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('select-repository', defaultPath),

  indexRepository: (repoRoot: string): Promise<string[]> =>
    ipcRenderer.invoke('index-repository', repoRoot),

  parseBlocks: (content: string): Promise<any> =>
    ipcRenderer.invoke('parse-blocks', content),

  validateBlocks: (blocks: any[], repoRoot: string): Promise<ValidationError[]> =>
    ipcRenderer.invoke('validate-blocks', blocks, repoRoot),

  buildApplyPlan: (blocks: any[], repoRoot: string): Promise<ApplyPlan | ValidationError[]> =>
    ipcRenderer.invoke('build-apply-plan', blocks, repoRoot),

  applyChanges: (plan: ApplyPlan, repoRoot: string): Promise<{ success: boolean; backupPath?: string; errors?: string[] }> =>
    ipcRenderer.invoke('apply-changes', plan, repoRoot),

  undoLastApply: (repoRoot: string): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke('undo-last-apply', repoRoot),
};

contextBridge.exposeInMainWorld('inscribeAPI', api);
