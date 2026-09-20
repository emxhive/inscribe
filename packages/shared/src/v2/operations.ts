import { StructuralSelector } from './targets';

export type OperationStrategy = 'create_file' | 'replace_file' | 'delete_file' | 'replace_text' | 'replace_node';

export interface RawPayload {
  strategy: OperationStrategy;
  filePath: string;
  content: string;
  directives?: Record<string, string>;
}

export interface NormalizedPayload {
  strategy: OperationStrategy;
  filePath: string;
  content: string;
  directives: Record<string, string>;
}

export interface ReplaceNodeOperation {
  strategy: 'replace_node';
  filePath: string;
  content: string;
  selector: StructuralSelector;
}

export type InscribeOperation =
  | { strategy: 'create_file'; filePath: string; content: string }
  | { strategy: 'replace_file'; filePath: string; content: string }
  | { strategy: 'delete_file'; filePath: string }
  | { strategy: 'replace_text'; filePath: string; content: string; search: string }
  | ReplaceNodeOperation;
