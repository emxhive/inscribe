import { CanonicalExecution } from '../protocol';

export interface V2ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface V2Validator {
  validate(execution: CanonicalExecution): Promise<V2ValidationResult>;
}
