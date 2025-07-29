import React from 'react';
import { Invoice, InvoiceStatus } from '../../types/invoice';
import './InvoiceHeader.css';

interface InvoiceHeaderProps {
  invoice: Invoice;
  onUpdate: (updates: Partial<Invoice>) => void;
  onUpdateImmediate?: (updates: Partial<Invoice>) => void;
}

const InvoiceHeader: React.FC<InvoiceHeaderProps> = ({ invoice, onUpdate, onUpdateImmediate }) => {
  // Use immediate updates for dropdowns and dates, debounced for text fields
  const updateImmediate = onUpdateImmediate || onUpdate;
  
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateImmediate({ status: e.target.value as InvoiceStatus });
  };

  const handleDateChange = (field: 'date' | 'due_date', value: string) => {
    updateImmediate({ [field]: value || null });
  };

  return (
    <div className="invoice-header">
      <div className="invoice-title-section">
        <h1>INVOICE</h1>
        <div className="invoice-number">{invoice.number}</div>
      </div>
      
      <div className="invoice-meta">
        <div className="meta-item">
          <label>Invoice Name (optional)</label>
          <input
            type="text"
            value={invoice.name || ''}
            onChange={(e) => onUpdate({ name: e.target.value || null })}
            placeholder="e.g., Project Name"
          />
        </div>
        
        <div className="meta-item">
          <label>Status</label>
          <select value={invoice.status} onChange={handleStatusChange}>
            <option value={InvoiceStatus.Draft}>Draft</option>
            <option value={InvoiceStatus.Sent}>Sent</option>
            <option value={InvoiceStatus.Paid}>Paid</option>
            <option value={InvoiceStatus.Overdue}>Overdue</option>
          </select>
        </div>
        
        <div className="meta-item">
          <label>Invoice Date</label>
          <input
            type="date"
            value={invoice.date}
            onChange={(e) => handleDateChange('date', e.target.value)}
            required
          />
        </div>
        
        <div className="meta-item">
          <label>Due Date</label>
          <input
            type="date"
            value={invoice.due_date || ''}
            onChange={(e) => handleDateChange('due_date', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default InvoiceHeader;