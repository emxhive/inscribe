import { Modal } from './common';
import { Button } from '@/components/ui/button';
import { KEYBOARD_SHORTCUTS } from '@/utils/keyboardShortcuts';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Keyboard Shortcuts"
      size="large"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="divide-y divide-border rounded-md border border-border">
        {KEYBOARD_SHORTCUTS.map((shortcut) => (
          <div key={shortcut.id} className="grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-4 px-3 py-2.5">
            <kbd className="w-fit rounded border border-border bg-secondary px-2 py-1 font-mono text-xs text-foreground">
              {shortcut.display}
            </kbd>
            <div>
              <div className="text-sm font-medium text-foreground">{shortcut.label}</div>
              <div className="text-xs text-muted-foreground">{shortcut.description}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Shortcuts use Ctrl on Windows/Linux and the primary modifier on macOS. Except for Ctrl+`, they yield to focused editors, inputs, controls, the embedded terminal, and open modals/overlays. Ctrl+V keeps normal paste intact in editable fields. Ctrl+↵ follows the current primary workspace action and does nothing when that action is unavailable.
      </p>
    </Modal>
  );
}
