import React, { useMemo, useRef, useState } from 'react';
import {
  DIRECTIVE_KEYS,
  HEADER_KEYS,
  VALID_MODES,
  type DirectiveKey,
  type HeaderKey,
} from '@inscribe/shared';
import { cn } from '@/lib/utils';
import type { IntakeBlock } from '@/utils/intake';

type HeaderDirectiveEditorProps = {
  block: IntakeBlock | null;
  onHeaderChange: (key: HeaderKey, value: string) => void;
  onDirectiveChange: (key: DirectiveKey, value: string) => void;
  onAddDirective: (key: DirectiveKey) => void;
};

type AccordionSection = 'headers' | 'directives' | null;

export function HeaderDirectiveEditor({
  block,
  onHeaderChange,
  onDirectiveChange,
  onAddDirective,
}: HeaderDirectiveEditorProps) {
  const modeListId = 'mode-header-options';
  const directiveRefs = useRef(new Map<string, HTMLInputElement | null>());
  const [openSection, setOpenSection] = useState<AccordionSection>('headers');

  const presentDirectives = useMemo(
    () => (block ? DIRECTIVE_KEYS.filter((key) => block.directives[key]) : []),
    [block],
  );
  const missingDirectives = useMemo(
    () => (block ? DIRECTIVE_KEYS.filter((key) => !block.directives[key]) : DIRECTIVE_KEYS),
    [block],
  );

  const handleToggleSection = (section: AccordionSection) => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

  if (!block) {
    return (
      <div className="border-t border-border pt-3 max-h-[50%]">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          Headers & Directives
        </p>
        <p className="text-xs text-muted-foreground mt-2">Select a block to edit.</p>
      </div>
    );
  }

  return (
    <div className="border-t border-border pt-3 max-h-[50%] min-h-0 flex flex-col overflow-hidden">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
        Headers & Directives
      </p>
      <div className="mt-3 flex flex-col gap-3 min-h-0 flex-1">
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 flex flex-col min-h-0">
          <button
            type="button"
            onClick={() => handleToggleSection('headers')}
            className="flex w-full items-center justify-between text-left text-[11px] font-semibold uppercase tracking-wider text-foreground"
            aria-expanded={openSection === 'headers'}
          >
            <span>Headers</span>
            <span className="text-xs text-muted-foreground">{openSection === 'headers' ? '−' : '+'}</span>
          </button>
          <div
            className={cn(
              'mt-2 space-y-3 overflow-y-auto pr-1 flex-1 min-h-0',
              openSection === 'headers' ? 'flex flex-col' : 'hidden',
            )}
          >
            {HEADER_KEYS.map((key) => (
              <label key={key} className="block text-xs text-muted-foreground">
                <span className="text-[11px] font-semibold text-foreground">{key}</span>
                <input
                  value={block.directives[key]?.value ?? ''}
                  onChange={(event) => onHeaderChange(key, event.target.value)}
                  list={key === 'MODE' ? modeListId : undefined}
                  className="mt-1 w-full rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder={`${key}:`}
                />
              </label>
            ))}
            <datalist id={modeListId}>
              {VALID_MODES.map((mode) => (
                <option key={mode} value={mode} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 min-h-0 flex flex-col">
          <button
            type="button"
            onClick={() => handleToggleSection('directives')}
            className="flex w-full items-center justify-between text-left text-[11px] font-semibold uppercase tracking-wider text-foreground"
            aria-expanded={openSection === 'directives'}
          >
            <span>Directives</span>
            <span className="text-xs text-muted-foreground">{openSection === 'directives' ? '−' : '+'}</span>
          </button>
          <div
            className={cn(
              'mt-2 space-y-3 overflow-y-auto pr-1 min-h-0 flex-1',
              openSection === 'directives' ? 'flex flex-col' : 'hidden',
            )}
          >
            {presentDirectives.length > 0 ? (
              presentDirectives.map((key) => (
                <label key={key} className="block text-xs text-muted-foreground">
                  <span className="text-[11px] font-semibold text-foreground">{key}</span>
                  <input
                    ref={(element) => directiveRefs.current.set(key, element)}
                    value={block.directives[key]?.value ?? ''}
                    onChange={(event) => onDirectiveChange(key, event.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder={`${key}:`}
                  />
                </label>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No directives found.</p>
            )}
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-foreground">Add directive</label>
              <select
                className="flex-1 rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                value=""
                onChange={(event) => {
                  if (event.target.value) {
                    const nextKey = event.target.value as DirectiveKey;
                    onAddDirective(nextKey);
                    requestAnimationFrame(() => {
                      directiveRefs.current.get(nextKey)?.focus();
                    });
                  }
                }}
              >
                <option value="" disabled>Select</option>
                {missingDirectives.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </div>
            {(block.warnings.length > 0 || block.errors.length > 0) && (
              <div className="rounded-md border border-border bg-muted/50 p-2 text-[11px] text-muted-foreground">
                {block.errors.length > 0 && (
                  <p className="text-red-700">Error: {block.errors[0]}</p>
                )}
                {block.warnings.length > 0 && (
                  <p className="text-amber-700">Warning: {block.warnings[0]}</p>
                )}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">Changes update the raw text inline.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
