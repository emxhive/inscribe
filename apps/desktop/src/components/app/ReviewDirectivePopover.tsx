import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ReviewItem } from '@/types';
import {
  DIRECTIVE_KEYS,
  HEADER_KEYS,
  VALID_MODES,
  type DirectiveKey,
  type HeaderKey,
} from '@inscribe/shared';
import { Select } from '@/components/ui/select';

type EditableKey = HeaderKey | DirectiveKey;

type ReviewDirectivePopoverProps = {
  isOpen: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  item: ReviewItem | null;
  onSave: (updates: Partial<Record<EditableKey, string>>) => void;
  onClose: () => void;
};

export function ReviewDirectivePopover({
  isOpen,
  anchorRef,
  item,
  onSave,
  onClose,
}: ReviewDirectivePopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<Partial<Record<EditableKey, string>>>({});
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!isOpen || !item) {
      setPosition(null);
      return;
    }
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) {
      setPosition(null);
      return;
    }
    setPosition({ top: rect.top + rect.height / 2, left: rect.right + 12 });
  }, [anchorRef, isOpen, item]);

  useEffect(() => {
    if (!isOpen || !item) {
      setDraft({});
      return;
    }
    // Initialize draft from headers (file, mode) and directives
    const nextDraft: Partial<Record<EditableKey, string>> = {
      FILE: item.file ?? '',
      MODE: item.mode ?? '',
    };
    // Add directives from item.directives
    DIRECTIVE_KEYS.forEach((key) => {
      if (item.directives[key]) {
        nextDraft[key] = item.directives[key];
      }
    });
    setDraft(nextDraft);
  }, [isOpen, item]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        popoverRef.current?.contains(target ?? null) ||
        anchorRef.current?.contains(target ?? null)
      ) {
        return;
      }
      onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [anchorRef, isOpen, onClose]);

  const presentDirectiveKeys = useMemo(
    () => DIRECTIVE_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(draft, key)),
    [draft],
  );
  const missingDirectiveKeys = useMemo(
    () => DIRECTIVE_KEYS.filter((key) => !Object.prototype.hasOwnProperty.call(draft, key)),
    [draft],
  );

  if (!isOpen || !item || !position) {
    return null;
  }

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-80 rounded-lg border border-border bg-card shadow-lg p-3"
      style={{ top: position.top, left: position.left, transform: 'translateY(-50%)' }}
    >
      <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
        Edit Headers & Directives
      </p>
      <div className="mt-3 space-y-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Headers
          </p>
          <div className="mt-2 space-y-2.5">
            {HEADER_KEYS.map((key) => (
              <label key={key} className="block text-xs text-muted-foreground">
                <span className="text-[11px] font-semibold text-foreground">{key}</span>
                {key === 'MODE' ? (
                  <Select
                    className="mt-1 font-mono"
                    value={draft.MODE ?? ''}
                    placeholder="MODE:"
                    options={VALID_MODES.map((mode) => ({ value: mode, label: mode }))}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        MODE: event.target.value,
                      }))
                    }
                  />
                ) : (
                  <input
                    value={draft[key] ?? ''}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        [key]: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder={`${key}:`}
                  />
                )}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Directives
          </p>
          <div className="mt-2 space-y-2.5">
            {presentDirectiveKeys.length > 0 ? (
              presentDirectiveKeys.map((key) => (
                <label key={key} className="block text-xs text-muted-foreground">
                  <span className="text-[11px] font-semibold text-foreground">{key}</span>
                  <input
                    value={draft[key] ?? ''}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        [key]: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder={`${key}:`}
                  />
                </label>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No directives yet.</p>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <label className="text-[11px] font-semibold text-foreground">Add directive</label>
            <Select
              className="flex-1"
              value=""
              placeholder="Select"
              options={missingDirectiveKeys.map((key) => ({ value: key, label: key }))}
              onChange={(event) => {
                if (event.target.value) {
                  const key = event.target.value as DirectiveKey;
                  setDraft((prev) => ({
                    ...prev,
                    [key]: prev[key] ?? '',
                  }));
                }
              }}
            />
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-secondary/70"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(draft)}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Save
        </button>
      </div>
    </div>
  );
}
