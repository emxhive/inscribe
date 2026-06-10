export type V2OperationStrategy = 'create_file' | 'replace_file' | 'delete_file' | 'replace_text';

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
