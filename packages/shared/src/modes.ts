export const OPERATION_MODES = [
  'create_file',
  'replace_file',
  'append_file',
  'delete_file',
  'replace_line',
  'replace_range',
  'replace_between',
  'replace_block',
  'replace_symbol',
] as const;

export type OperationMode = (typeof OPERATION_MODES)[number];
export type ModeCategory = 'file' | 'text' | 'structural';

export interface OperationModeMetadata {
  category: ModeCategory;
  fileExistence: 'must_exist' | 'must_not_exist';
  content: 'required' | 'forbidden';
  allowEmptyContent: boolean;
  requiredDirectives: string[];
  allowedDirectives: string[];
}

export const OPERATION_MODE_METADATA: Record<OperationMode, OperationModeMetadata> = {
  create_file: { category: 'file', fileExistence: 'must_not_exist', content: 'required', allowEmptyContent: true, requiredDirectives: [], allowedDirectives: [] },
  replace_file: { category: 'file', fileExistence: 'must_exist', content: 'required', allowEmptyContent: true, requiredDirectives: [], allowedDirectives: [] },
  append_file: { category: 'file', fileExistence: 'must_exist', content: 'required', allowEmptyContent: false, requiredDirectives: [], allowedDirectives: [] },
  delete_file: { category: 'file', fileExistence: 'must_exist', content: 'forbidden', allowEmptyContent: true, requiredDirectives: [], allowedDirectives: [] },
  replace_line: { category: 'text', fileExistence: 'must_exist', content: 'required', allowEmptyContent: true, requiredDirectives: ['START'], allowedDirectives: ['START'] },
  replace_range: { category: 'text', fileExistence: 'must_exist', content: 'required', allowEmptyContent: true, requiredDirectives: ['START', 'END'], allowedDirectives: ['START', 'END', 'CONTAINS'] },
  replace_between: { category: 'text', fileExistence: 'must_exist', content: 'required', allowEmptyContent: true, requiredDirectives: ['START', 'END'], allowedDirectives: ['START', 'END', 'CONTAINS'] },
  replace_block: { category: 'structural', fileExistence: 'must_exist', content: 'required', allowEmptyContent: true, requiredDirectives: ['START'], allowedDirectives: ['START'] },
  replace_symbol: { category: 'structural', fileExistence: 'must_exist', content: 'required', allowEmptyContent: true, requiredDirectives: ['NAME'], allowedDirectives: ['NAME'] },
};

export function isValidMode(mode: string): mode is OperationMode {
  return (OPERATION_MODES as readonly string[]).includes(mode);
}

export function getOperationModeMetadata(mode: OperationMode): OperationModeMetadata { return OPERATION_MODE_METADATA[mode]; }
export function modeRequiresContent(mode: OperationMode): boolean { return OPERATION_MODE_METADATA[mode].content === 'required'; }
export function modeAllowsEmptyContent(mode: OperationMode): boolean { return OPERATION_MODE_METADATA[mode].allowEmptyContent; }
export function modeAllowsDirective(mode: OperationMode, directive: string): boolean { return OPERATION_MODE_METADATA[mode].allowedDirectives.includes(directive); }
export function getRequiredDirectives(mode: OperationMode): string[] { return [...OPERATION_MODE_METADATA[mode].requiredDirectives]; }
export function getAllowedDirectives(mode: OperationMode): string[] { return [...OPERATION_MODE_METADATA[mode].allowedDirectives]; }
export function getModesByCategory(category: ModeCategory): OperationMode[] { return OPERATION_MODES.filter(m => OPERATION_MODE_METADATA[m].category === category); }
