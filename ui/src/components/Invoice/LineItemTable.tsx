import React, { useState, useRef, useEffect } from 'react';
import type { LineItem } from '../../types/invoice';
import { useInvoiceStore } from '../../store/invoice';
import { uploadReceipt, getReceipt } from '../../utils/invoiceApi';
import PDFViewer from './PDFViewer';
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
  const [receiptModalData, setReceiptModalData] = useState<{ data: Uint8Array; fileName: string; mimeType: string } | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const modalRef = useRef<HTMLDivElement>(null);

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
      // Clear the file input
      if (fileInputRefs.current[itemId]) {
        fileInputRefs.current[itemId].value = '';
      }
    }
  };

  const handleViewReceipt = async (receiptPath: string, fileName: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      const receiptData = await getReceipt(receiptPath);
      
      // Convert number array to Uint8Array
      const uint8Array = new Uint8Array(receiptData);
      
      // Determine mime type from filename
      let mimeType = 'application/octet-stream';
      if (fileName.toLowerCase().endsWith('.pdf')) {
        mimeType = 'application/pdf';
      } else if (fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.jpeg')) {
        mimeType = 'image/jpeg';
      } else if (fileName.toLowerCase().endsWith('.png')) {
        mimeType = 'image/png';
      }
      
      setReceiptModalData({ data: uint8Array, fileName, mimeType });
    } catch (error) {
      console.error('Failed to view receipt:', error);
      alert('Failed to load receipt. Please try again.');
    }
  };

  const closeModal = () => {
    setReceiptModalData(null);
  };

  // Handle click outside modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && event.target === modalRef.current) {
        closeModal();
      }
    };

    if (receiptModalData) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [receiptModalData]);

  // Handle escape key
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && receiptModalData) {
        closeModal();
      }
    };

    if (receiptModalData) {
      document.addEventListener('keydown', handleEscKey);
      return () => document.removeEventListener('keydown', handleEscKey);
    }
  }, [receiptModalData]);

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
    <>
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
                      onClick={(e) => handleViewReceipt(item.receipt_path!, item.receipt_path!.split('/').pop()!, e)}
                      className="btn btn-link btn-small"
                      title="View receipt"
                      type="button"
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

    {/* Receipt Modal */}
    {receiptModalData && (
      <div className="receipt-modal" ref={modalRef}>
        <span className="modal-close" onClick={closeModal}>&times;</span>
        <div className="modal-content">
          {receiptModalData.mimeType === 'application/pdf' ? (
            <PDFViewer 
              pdfData={receiptModalData.data}
              fileName={receiptModalData.fileName}
            />
          ) : (
            <div style={{ 
              backgroundColor: 'var(--surface)',
              maxWidth: '90vw', 
              maxHeight: '90vh', 
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '8px'
            }}>
              <div style={{ 
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--surface)',
                position: 'sticky',
                top: 0,
                zIndex: 1
              }}>
                <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{receiptModalData.fileName}</h3>
              </div>
              <div style={{
                padding: '20px',
                backgroundColor: 'var(--background)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flex: 1
              }}>
                <img 
                  src={URL.createObjectURL(new Blob([receiptModalData.data], { type: receiptModalData.mimeType }))} 
                  alt={receiptModalData.fileName}
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '100%',
                    height: 'auto',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}
                  onLoad={(e) => {
                    // Clean up the blob URL after the image loads
                    const img = e.target as HTMLImageElement;
                    setTimeout(() => URL.revokeObjectURL(img.src), 100);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    )}
    </>
  );
};

export default LineItemTable;