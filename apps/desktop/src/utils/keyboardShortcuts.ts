export type KeyboardShortcutId =
  | 'paste-intake'
  | 'open-repository'
  | 'open-recent-repositories'
  | 'open-history'
  | 'open-intake-file'
  | 'toggle-terminal'
  | 'show-keyboard-shortcuts'
  | 'primary-action';

export interface KeyboardShortcut {
  id: KeyboardShortcutId;
  label: string;
  description: string;
  display: string;
  key: string;
  code: string;
  shift?: boolean;
  isGlobal?: boolean;
}

export const KEYBOARD_SHORTCUTS: readonly KeyboardShortcut[] = [
  {
    id: 'paste-intake',
    label: 'Paste Intake',
    description: 'Replace the Intake contents with clipboard text.',
    display: 'Ctrl+V',
    key: 'v',
    code: 'KeyV',
  },
  {
    id: 'open-repository',
    label: 'Open Repository',
    description: 'Choose and open a repository.',
    display: 'Ctrl+O',
    key: 'o',
    code: 'KeyO',
  },
  {
    id: 'open-recent-repositories',
    label: 'Open Recent Repositories',
    description: 'Show the recent repository list.',
    display: 'Ctrl+P',
    key: 'p',
    code: 'KeyP',
  },
  {
    id: 'open-history',
    label: 'Open History',
    description: 'Show the repository history panel.',
    display: 'Ctrl+H',
    key: 'h',
    code: 'KeyH',
  },
  {
    id: 'open-intake-file',
    label: 'Open Intake File',
    description: 'Load a Markdown file into Intake.',
    display: 'Ctrl+Shift+O',
    key: 'o',
    code: 'KeyO',
    shift: true,
  },
  {
    id: 'toggle-terminal',
    label: 'Toggle Terminal',
    description: 'Show or hide the repository terminal.',
    display: 'Ctrl+`',
    key: '`',
    code: 'Backquote',
    isGlobal: true,
  },
  {
    id: 'show-keyboard-shortcuts',
    label: 'Show Keyboard Shortcuts',
    description: 'Open this shortcut reference.',
    display: 'Ctrl+/',
    key: '/',
    code: 'Slash',
  },
  {
    id: 'primary-action',
    label: 'Primary Action',
    description: 'Run the workspace\'s current primary action.',
    display: 'Ctrl+↵',
    key: 'enter',
    code: 'Enter',
  },
] as const;

export function getKeyboardShortcutDisplay(id: KeyboardShortcutId): string {
  return KEYBOARD_SHORTCUTS.find((shortcut) => shortcut.id === id)?.display ?? '';
}

export function matchesKeyboardShortcut(
  event: Pick<KeyboardEvent, 'altKey' | 'code' | 'ctrlKey' | 'key' | 'metaKey' | 'shiftKey'>,
  shortcut: KeyboardShortcut,
): boolean {
  const primaryModifierPressed = event.ctrlKey !== event.metaKey;
  const keyMatches = event.code === shortcut.code || event.key.toLowerCase() === shortcut.key;

  return primaryModifierPressed
    && !event.altKey
    && event.shiftKey === Boolean(shortcut.shift)
    && keyMatches;
}

const INTERACTIVE_TARGET_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  '[contenteditable]',
  '[role="button"]',
  '[role="combobox"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="textbox"]',
].join(',');
const TEXT_EDITING_TARGET_SELECTOR = [
  'textarea:not([disabled]):not([readonly])',
  'input:not([disabled]):not([readonly]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"])',
  '[contenteditable="true"]',
].join(',');
const BLOCKING_OVERLAY_SELECTOR = '[data-inscribe-shortcut-overlay="true"]';

export function isInteractiveKeyboardTarget(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) {
    return false;
  }

  return target.matches(INTERACTIVE_TARGET_SELECTOR)
    || Boolean(target.closest(INTERACTIVE_TARGET_SELECTOR));
}

export function isTextEditingKeyboardTarget(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) {
    return false;
  }

  const isContentEditable = typeof HTMLElement !== 'undefined'
    && target instanceof HTMLElement
    && target.isContentEditable;

  return isContentEditable
    || target.matches(TEXT_EDITING_TARGET_SELECTOR)
    || Boolean(target.closest(TEXT_EDITING_TARGET_SELECTOR));
}

export function hasBlockingShortcutOverlay(): boolean {
  return typeof document !== 'undefined' && Boolean(document.querySelector(BLOCKING_OVERLAY_SELECTOR));
}

export function shouldHandleKeyboardShortcut(
  event: Pick<KeyboardEvent, 'altKey' | 'code' | 'ctrlKey' | 'key' | 'metaKey' | 'shiftKey'>,
  shortcut: KeyboardShortcut,
  isInteractiveTarget: boolean,
  hasBlockingOverlay = false,
  isTextEditingTarget = isInteractiveTarget,
): boolean {
  return matchesKeyboardShortcut(event, shortcut)
    && (shortcut.isGlobal === true || (
      !hasBlockingOverlay &&
      (shortcut.id === 'paste-intake' ? !isTextEditingTarget : !isInteractiveTarget)
    ));
}
