import type { ApplyPlan, ValidationError } from '@inscribe/shared';

declare global {
  interface Window {
    inscribeAPI: {
      selectRepository: (defaultPath?: string) => Promise<string | null>;
      indexRepository: (repoRoot: string) => Promise<string[]>;
      parseBlocks: (content: string) => Promise<any>;
      validateBlocks: (blocks: any[], repoRoot: string) => Promise<ValidationError[]>;
      buildApplyPlan: (blocks: any[], repoRoot: string) => Promise<ApplyPlan | ValidationError[]>;
      applyChanges: (plan: ApplyPlan, repoRoot: string) => Promise<{ success: boolean; backupPath?: string; errors?: string[] }>;
      undoLastApply: (repoRoot: string) => Promise<{ success: boolean; message: string }>;
    };
  }
}

export {};
