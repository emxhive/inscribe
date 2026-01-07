import React from 'react';
import { Modal, Button } from './common';

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
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {items.length === 0 ? (
        <p className="empty-message">{emptyMessage}</p>
      ) : (
        <ul className="item-list">
          {items.map((item, index) => (
            <li key={index} className="item">
              {item}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
