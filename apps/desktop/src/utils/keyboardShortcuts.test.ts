import { describe, expect, it, vi } from 'vitest';
import {
  KEYBOARD_SHORTCUTS,
  getKeyboardShortcutDisplay,
  hasBlockingShortcutOverlay,
  matchesKeyboardShortcut,
  shouldHandleKeyboardShortcut,
} from './keyboardShortcuts';

describe('keyboard shortcuts', () => {
  it('matches primary modifier shortcuts while distinguishing Shift variants', () => {
    const openRepository = KEYBOARD_SHORTCUTS.find((shortcut) => shortcut.id === 'open-repository')!;
    const openIntakeFile = KEYBOARD_SHORTCUTS.find((shortcut) => shortcut.id === 'open-intake-file')!;

    expect(matchesKeyboardShortcut({ ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: 'o', code: 'KeyO' }, openRepository)).toBe(true);
    expect(matchesKeyboardShortcut({ ctrlKey: true, metaKey: false, altKey: false, shiftKey: true, key: 'O', code: 'KeyO' }, openRepository)).toBe(false);
    expect(matchesKeyboardShortcut({ ctrlKey: true, metaKey: false, altKey: false, shiftKey: true, key: 'O', code: 'KeyO' }, openIntakeFile)).toBe(true);
  });

  it('matches the primary action shortcut only with an unmodified Enter', () => {
    const primaryAction = KEYBOARD_SHORTCUTS.find((shortcut) => shortcut.id === 'primary-action')!;

    expect(getKeyboardShortcutDisplay('primary-action')).toBe('Ctrl+↵');
    expect(matchesKeyboardShortcut({ ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: 'Enter', code: 'Enter' }, primaryAction)).toBe(true);
    expect(matchesKeyboardShortcut({ ctrlKey: true, metaKey: false, altKey: false, shiftKey: true, key: 'Enter', code: 'Enter' }, primaryAction)).toBe(false);
  });

  it('supports the platform primary modifier for discoverable Ctrl shortcuts', () => {
    const showShortcuts = KEYBOARD_SHORTCUTS.find((shortcut) => shortcut.id === 'show-keyboard-shortcuts')!;

    expect(matchesKeyboardShortcut({ ctrlKey: false, metaKey: true, altKey: false, shiftKey: false, key: '/', code: 'Slash' }, showShortcuts)).toBe(true);
  });

  it('requires exact modifier state', () => {
    const openRepository = KEYBOARD_SHORTCUTS.find((shortcut) => shortcut.id === 'open-repository')!;

    expect(matchesKeyboardShortcut({ ctrlKey: true, metaKey: false, altKey: true, shiftKey: false, key: 'o', code: 'KeyO' }, openRepository)).toBe(false);
    expect(matchesKeyboardShortcut({ ctrlKey: true, metaKey: true, altKey: false, shiftKey: false, key: 'o', code: 'KeyO' }, openRepository)).toBe(false);
    expect(matchesKeyboardShortcut({ ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: 'O', code: 'KeyO' }, openRepository)).toBe(true);
  });

  it('protects interactive targets by default while allowing explicit global shortcuts', () => {
    const openRecentRepositories = KEYBOARD_SHORTCUTS.find((shortcut) => shortcut.id === 'open-recent-repositories')!;
    const pasteIntake = KEYBOARD_SHORTCUTS.find((shortcut) => shortcut.id === 'paste-intake')!;
    const toggleTerminal = KEYBOARD_SHORTCUTS.find((shortcut) => shortcut.id === 'toggle-terminal')!;
    const primaryAction = KEYBOARD_SHORTCUTS.find((shortcut) => shortcut.id === 'primary-action')!;
    const event = { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: 'p', code: 'KeyP' };

    expect(shouldHandleKeyboardShortcut(event, openRecentRepositories, true)).toBe(false);
    expect(shouldHandleKeyboardShortcut(event, openRecentRepositories, false)).toBe(true);
    expect(shouldHandleKeyboardShortcut(event, openRecentRepositories, false, true)).toBe(false);
    expect(shouldHandleKeyboardShortcut({ ...event, key: 'v', code: 'KeyV' }, pasteIntake, true)).toBe(false);
    expect(shouldHandleKeyboardShortcut({ ...event, key: '`', code: 'Backquote' }, toggleTerminal, true)).toBe(true);
    expect(shouldHandleKeyboardShortcut({ ...event, key: '`', code: 'Backquote' }, toggleTerminal, false, true)).toBe(true);
    expect(shouldHandleKeyboardShortcut({ ...event, key: 'Enter', code: 'Enter' }, primaryAction, true)).toBe(false);
    expect(shouldHandleKeyboardShortcut({ ...event, key: 'Enter', code: 'Enter' }, primaryAction, false)).toBe(true);
  });

  it('detects the shared blocking overlay marker', () => {
    vi.stubGlobal('document', { querySelector: vi.fn(() => ({})) });
    expect(hasBlockingShortcutOverlay()).toBe(true);

    vi.stubGlobal('document', { querySelector: vi.fn(() => null) });
    expect(hasBlockingShortcutOverlay()).toBe(false);

    vi.unstubAllGlobals();
  });
});
