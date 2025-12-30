import React from 'react';

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
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
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
        </div>
        <div className="modal-footer">
          <button className="primary-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
