import React from 'react';
import { useInvoiceStore } from '../../store/invoice';
import './InvoiceList.css';

interface InvoiceListProps {
  onOpenSettings: () => void;
}

const InvoiceList: React.FC<InvoiceListProps> = ({ onOpenSettings }) => {
  const {
    invoices,
    invoicesLoading,
    invoicesError,
    createInvoice,
    loadInvoice,
    deleteInvoice
  } = useInvoiceStore();

  const handleCreateNew = async () => {
    try {
      await createInvoice();
    } catch (error) {
      console.error('Failed to create invoice:', error);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this invoice?')) {
      try {
        await deleteInvoice(id);
      } catch (error) {
        console.error('Failed to delete invoice:', error);
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  const getStatusClass = (status: string) => {
    return `status status-${status.toLowerCase()}`;
  };

  if (invoicesLoading) {
    return (
      <div className="invoice-list-container">
        <div className="loading">Loading invoices...</div>
      </div>
    );
  }

  if (invoicesError) {
    return (
      <div className="invoice-list-container">
        <div className="error">Error loading invoices: {invoicesError}</div>
      </div>
    );
  }

  return (
    <div className="invoice-list-container">
      <div className="invoice-list-toolbar">
        <h2>Invoices</h2>
        <div className="invoice-list-actions">
          <button 
            onClick={handleCreateNew} 
            className="btn btn-primary"
          >
            + New Invoice
          </button>
          <button
            onClick={onOpenSettings}
            className="btn btn-secondary"
          >
            Settings
          </button>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="empty-state">
          <p>No invoices yet.</p>
          <p>Click "+ New Invoice" to get started.</p>
        </div>
      ) : (
        <div className="invoice-list">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="invoice-list-row"
              onClick={() => loadInvoice(invoice.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  loadInvoice(invoice.id);
                }
              }}
            >
              <div className="invoice-row-left">
                <h3 className="invoice-number">{invoice.number}</h3>
                {invoice.name && (
                  <div className="invoice-name">{invoice.name}</div>
                )}
              </div>

              <div className="invoice-row-middle">
                <span className={getStatusClass(invoice.status)}>
                  {invoice.status}
                </span>
                <span className="invoice-date">
                  {formatDate(invoice.date)}
                </span>
              </div>

              <div className="invoice-row-right">
                <div className="invoice-total">
                  {formatCurrency(invoice.total)}
                </div>
                <button
                  onClick={(e) => handleDelete(e, invoice.id)}
                  className="btn btn-link-inline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InvoiceList;
