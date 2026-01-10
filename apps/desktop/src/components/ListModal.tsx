import React from 'react';
import { Modal } from './common';
import { Button } from '@/components/ui/button';

interface ListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: string[];
  emptyMessage?: string;
}

export function ListModal({
  isOpen,
  onClose,
  title,
  items,
  emptyMessage = 'No items',
}: ListModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <Button onClick={onClose}>
          Close
        </Button>
      }
    >
      {items.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">{emptyMessage}</p>
      ) : (
        <ul className="list-none p-0 m-0">
          {items.map((item, index) => (
            <li key={index} className="p-3 border border-border rounded-md mb-2 bg-secondary">
              {item}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
