import React, { useState, useRef } from 'react';
import type { LineItem } from '../../types/invoice';
import { useInvoiceStore } from '../../store/invoice';
import { uploadReceipt, getReceipt } from '../../utils/invoiceApi';
import './LineItemTable.css';

interface LineItemTableProps {
  items: LineItem[];
  onAddItem: () => void;
}

const LineItemTable: React.FC<LineItemTableProps> = ({ items, onAddItem }) => {
  const { updateLineItem, deleteLineItem, fetchCurrentInvoice } = useInvoiceStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

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

  const handleReceiptUpload = async (itemId: string, file: File) => {
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload an image (JPEG, PNG) or PDF file');
      return;
    }
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }
    
    setUploadingReceipt(itemId);
    try {
      await uploadReceipt(itemId, file);
      // Refresh the invoice to get the updated receipt path
      await fetchCurrentInvoice();
    } catch (error) {
      console.error('Failed to upload receipt:', error);
      alert('Failed to upload receipt. Please try again.');
    } finally {
      setUploadingReceipt(null);
    }
  };

  const handleViewReceipt = async (receiptPath: string, fileName: string) => {
    try {
      const blob = await getReceipt(receiptPath);
      const url = URL.createObjectURL(blob);
      
      // Open in new tab
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = fileName;
      link.click();
      
      // Clean up
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error('Failed to view receipt:', error);
      alert('Failed to load receipt. Please try again.');
    }
  };

  const handleDragOver = (e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverItemId(itemId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverItemId(null);
  };

  const handleDrop = async (e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverItemId(null);
    
    const files = Array.from(e.dataTransfer.files);
    const file = files[0];
    
    if (file) {
      await handleReceiptUpload(itemId, file);
    }
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
            <th className="receipt-col">Receipt</th>
            <th className="actions-col"></th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={6} className="empty-state">
                No line items yet. Click "Add Item" to get started.
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr 
                key={item.id}
                className={dragOverItemId === item.id ? 'drag-over' : ''}
                onDragOver={(e) => handleDragOver(e, item.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, item.id)}
              >
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
                <td className="receipt-col">
                  {item.receipt_path ? (
                    <button
                      onClick={() => handleViewReceipt(item.receipt_path!, item.receipt_path!.split('/').pop()!)}
                      className="btn btn-link btn-small"
                      title="View receipt"
                    >
                      View Receipt
                    </button>
                  ) : (
                    <>
                      <input
                        ref={(el) => fileInputRefs.current[item.id] = el}
                        type="file"
                        accept="image/*,.pdf"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleReceiptUpload(item.id, file);
                          }
                        }}
                      />
                      <button
                        onClick={() => fileInputRefs.current[item.id]?.click()}
                        className="btn btn-secondary btn-small"
                        disabled={uploadingReceipt === item.id}
                      >
                        {uploadingReceipt === item.id ? 'Uploading...' : 'Upload'}
                      </button>
                    </>
                  )}
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