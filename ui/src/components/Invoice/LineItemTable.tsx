import React, { useState } from 'react';
import type { LineItem } from '../../types/invoice';
import { useInvoiceStore } from '../../store/invoice';
import './LineItemTable.css';

interface LineItemTableProps {
  items: LineItem[];
  onAddItem: () => void;
}

const LineItemTable: React.FC<LineItemTableProps> = ({ items, onAddItem }) => {
  const { updateLineItem, deleteLineItem } = useInvoiceStore();
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleFieldChange = (
    itemId: string,
    field: keyof LineItem,
    value: string | number
  ) => {
    updateLineItem(itemId, { [field]: value });
  };

  const handleQuantityChange = (itemId: string, value: string) => {
    const quantity = parseFloat(value) || 0;
    updateLineItem(itemId, { quantity });
  };

  const handleRateChange = (itemId: string, value: string) => {
    const rate = parseFloat(value) || 0;
    updateLineItem(itemId, { rate });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="line-items-container">
      <div className="line-items-header">
        <h3>Line Items</h3>
        <button onClick={onAddItem} className="btn btn-primary btn-small">
          + Add Item
        </button>
      </div>

      <table className="line-items-table">
        <thead>
          <tr>
            <th className="description-col">Description</th>
            <th className="quantity-col">Quantity</th>
            <th className="rate-col">Rate</th>
            <th className="amount-col">Amount</th>
            <th className="actions-col"></th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={5} className="empty-state">
                No line items yet. Click "Add Item" to get started.
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id}>
                <td className="description-col">
                  {editingId === item.id ? (
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleFieldChange(item.id, 'description', e.target.value)}
                      onBlur={() => setEditingId(null)}
                      onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                      autoFocus
                      className="edit-input"
                    />
                  ) : (
                    <div 
                      onClick={() => setEditingId(item.id)}
                      className="editable-cell"
                    >
                      {item.description || 'Click to add description'}
                    </div>
                  )}
                </td>
                <td className="quantity-col">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                    min="0"
                    step="0.01"
                    className="number-input"
                  />
                </td>
                <td className="rate-col">
                  <div className="rate-input-wrapper">
                    <span className="currency-symbol">$</span>
                    <input
                      type="number"
                      value={item.rate}
                      onChange={(e) => handleRateChange(item.id, e.target.value)}
                      min="0"
                      step="0.01"
                      className="number-input"
                    />
                  </div>
                </td>
                <td className="amount-col">
                  {formatCurrency(item.quantity * item.rate)}
                </td>
                <td className="actions-col">
                  <button
                    onClick={() => deleteLineItem(item.id)}
                    className="btn-icon delete-btn"
                    title="Remove item"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default LineItemTable;