import { StructuralSelector } from './targets';

export type V2OperationStrategy = 'create_file' | 'replace_file' | 'delete_file' | 'replace_text' | 'replace_node';

export interface V2RawPayload {
  strategy: V2OperationStrategy;
  filePath: string;
  content: string;
  directives?: Record<string, string>;
}

export interface V2NormalizedPayload {
  strategy: V2OperationStrategy;
  filePath: string;
  content: string;
  directives: Record<string, string>;
}

export interface ReplaceNodeOperationV2 {
  strategy: 'replace_node';
  filePath: string;
  content: string;
  selector: StructuralSelector;
}

export type V2Operation =
  | { strategy: 'create_file'; filePath: string; content: string }
  | { strategy: 'replace_file'; filePath: string; content: string }
  | { strategy: 'delete_file'; filePath: string }
  | { strategy: 'replace_text'; filePath: string; content: string; search: string }
  | ReplaceNodeOperationV2;
