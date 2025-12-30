import type { ApplyPlan, ValidationError } from '@inscribe/shared';

declare global {
  interface Window {
    inscribeAPI: {
      selectRepository: (defaultPath?: string) => Promise<string | null>;
      repoInit: (repoRoot: string) => Promise<any>;
      getScope: (repoRoot: string) => Promise<string[]>;
      setScope: (repoRoot: string, scope: string[]) => Promise<any>;
      readIgnore: (repoRoot: string) => Promise<any>;
      writeIgnore: (repoRoot: string, content: string) => Promise<any>;
      indexRepository: (repoRoot: string) => Promise<any>;
      indexStatus: (repoRoot: string) => Promise<any>;
      parseBlocks: (content: string) => Promise<any>;
      validateBlocks: (blocks: any[], repoRoot: string) => Promise<ValidationError[]>;
      buildApplyPlan: (blocks: any[], repoRoot: string) => Promise<ApplyPlan | ValidationError[]>;
      applyChanges: (plan: ApplyPlan, repoRoot: string) => Promise<{ success: boolean; backupPath?: string; errors?: string[] }>;
      undoLastApply: (repoRoot: string) => Promise<{ success: boolean; message: string }>;
    };
  }
}

export {};
