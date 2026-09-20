import type { SectionName } from '@inscribe/shared';

export interface IntakeDirective {
  key: string;
  value: string;
  lineIndex: number;
  raw: string;
}

/** Renderer metadata for the intake scanner. */
export interface IntakeBlock {
  id: string;
  index: number;
  startLine: number;
  endLine: number;
  directives: Partial<Record<string, IntakeDirective>>;
  warnings: string[];
  errors: string[];
  status: 'valid' | 'incomplete' | 'warning' | 'error';
  label: string;
  filePath?: string;
  mode?: string;
  selectorText?: string;
  sections?: Partial<Record<SectionName, {
    openLine: number;
    closeLine?: number;
    contentStartLine?: number;
    contentEndLine?: number;
    isEmpty?: boolean;
  }>>;
}

export interface IntakeLineMeta {
  text: string;
  lineIndex: number;
  blockId?: string;
  type:
    | 'text'
    | 'begin'
    | 'end'
    | 'header'
    | 'directive'
    | 'unknown-directive'
    | 'section-open'
    | 'section-close'
    | 'payload';
  status?: 'incomplete' | 'warning' | 'error';
}
