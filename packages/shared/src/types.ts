/**
 * Shared types for Inscribe
 */

export type Mode = 'create' | 'replace' | 'append' | 'range';

export interface ParsedBlock {
  file: string;
  mode: Mode;
  directives: Record<string, string>;
  content: string;
  blockIndex: number;
}

export interface ValidationError {
  blockIndex: number;
  file: string;
  message: string;
}

export interface Operation {
  type: Mode;
  file: string;
  content: string;
  directives?: Record<string, string>;
}

export interface ApplyPlan {
  operations: Operation[];
  errors?: ValidationError[];
}

export interface ApplyResult {
  success: boolean;
  backupPath?: string;
  errors?: string[];
}

export interface UndoResult {
  success: boolean;
  message: string;
}

export interface ParseResult {
  blocks: ParsedBlock[];
  errors: string[];
}
