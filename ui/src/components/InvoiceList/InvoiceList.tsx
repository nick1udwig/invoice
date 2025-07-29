import React from 'react';
import { useInvoiceStore } from '../../store/invoice';
import './InvoiceList.css';

const InvoiceList: React.FC = () => {
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
      <div className="invoice-list-header">
        <h2>Invoices</h2>
        <button onClick={handleCreateNew} className="btn btn-primary">
          + Create New Invoice
        </button>
      </div>

      {invoices.length === 0 ? (
        <div className="empty-state">
          <p>No invoices yet.</p>
          <p>Click "Create New Invoice" to get started.</p>
        </div>
      ) : (
        <div className="invoice-grid">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="invoice-card"
              onClick={() => loadInvoice(invoice.id)}
            >
              <div className="invoice-card-header">
                <h3>{invoice.number}</h3>
                <span className={getStatusClass(invoice.status)}>
                  {invoice.status}
                </span>
              </div>
              
              {invoice.name && (
                <div className="invoice-name">{invoice.name}</div>
              )}
              
              <div className="invoice-card-details">
                <div className="invoice-date">
                  {formatDate(invoice.date)}
                </div>
                <div className="invoice-total">
                  {formatCurrency(invoice.total)}
                </div>
              </div>
              
              <div className="invoice-card-actions">
                <button
                  onClick={(e) => handleDelete(e, invoice.id)}
                  className="btn btn-danger btn-sm"
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