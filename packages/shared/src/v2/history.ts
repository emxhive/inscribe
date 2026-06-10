import { V2OperationStrategy } from './operations';

export interface V2RestorePayload {
  schemaVersion: 2;
  executionId: string;
  filePath: string;
  strategy: V2OperationStrategy;
  beforeContent: string;
  afterContent: string;
  beforeHash: string;
  afterHash: string;
  timestamp: string;
}
