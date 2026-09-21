import { CanonicalExecution } from '../protocol';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface Validator {
  validate(execution: CanonicalExecution): Promise<ValidationResult>;
}
