import { V2OperationStrategy } from './operations';

export interface V2TargetScope {
  filePath: string;
  strategy: V2OperationStrategy;
  selector?: string;
  lineRange?: { startLine: number; endLine: number };
  beforeRange?: { start: number; end: number };
  afterRange?: { start: number; end: number };
}
