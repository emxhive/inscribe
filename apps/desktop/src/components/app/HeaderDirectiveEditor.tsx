import { useRef } from 'react';
import {
  DIRECTIVE_KEYS,
  OPERATION_MODES,
  type DirectiveKey,
  type HeaderKey,
} from '@inscribe/shared';
import type { IntakeBlock } from '@/utils/intake';
import { Select } from '@/components/ui/select';

type HeaderDirectiveEditorProps = {
  block: IntakeBlock | null;
  onHeaderChange: (key: HeaderKey, value: string) => void;
  onDirectiveChange: (key: DirectiveKey, value: string) => void;
  onAddDirective: (key: DirectiveKey) => void;
};

const fieldClassName = 'h-7 w-full rounded-md border border-border bg-background px-2 text-xs font-mono text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

export function HeaderDirectiveEditor({
  block,
  onHeaderChange,
  onDirectiveChange,
  onAddDirective,
}: HeaderDirectiveEditorProps) {
  const directiveRefs = useRef(new Map<string, HTMLInputElement | null>());

  if (!block) {
    return <p className="py-4 text-center text-xs text-muted-foreground">Select a block to inspect its properties.</p>;
  }

  const presentDirectives = DIRECTIVE_KEYS.filter((key) => block.directives[key]);
  const missingDirectives = DIRECTIVE_KEYS.filter((key) => !block.directives[key]);

  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Block</h3>
        <div className="divide-y divide-border border-y border-border">
          <label className="grid min-h-9 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 py-1">
            <span className="text-xs text-muted-foreground">File</span>
            <input
              value={block.directives.FILE?.value ?? ''}
              onChange={(event) => onHeaderChange('FILE', event.target.value)}
              className={fieldClassName}
              placeholder="Relative path"
            />
          </label>
          <label className="grid min-h-9 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 py-1">
            <span className="text-xs text-muted-foreground">Mode</span>
            <Select
              className="h-7 font-mono text-xs"
              value={block.directives.MODE?.value ?? ''}
              onChange={(event) => onHeaderChange('MODE', event.target.value)}
              placeholder="Select mode"
              options={OPERATION_MODES.map((mode) => ({ value: mode, label: mode }))}
            />
          </label>
        </div>
      </section>

      <section>
        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Directives</h3>
        <div className="divide-y divide-border border-y border-border">
          {presentDirectives.map((key) => (
            <label key={key} className="grid min-h-9 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 py-1">
              <span className="text-xs text-muted-foreground">{key}</span>
              <input
                ref={(element) => directiveRefs.current.set(key, element)}
                value={block.directives[key]?.value ?? ''}
                onChange={(event) => onDirectiveChange(key, event.target.value)}
                className={fieldClassName}
                placeholder={key}
              />
            </label>
          ))}
          {missingDirectives.length > 0 && (
            <label className="grid min-h-9 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 py-1">
              <span className="text-xs text-muted-foreground">Add</span>
              <Select
                className="h-7 text-xs"
                value=""
                placeholder="Directive"
                options={missingDirectives.map((key) => ({ value: key, label: key }))}
                onChange={(event) => {
                  if (!event.target.value) return;
                  const nextKey = event.target.value as DirectiveKey;
                  onAddDirective(nextKey);
                  requestAnimationFrame(() => directiveRefs.current.get(nextKey)?.focus());
                }}
              />
            </label>
          )}
        </div>
      </section>
    </div>
  );
}
