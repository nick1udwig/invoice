import React, { useState } from 'react';
import type { Invoice } from '../../types/invoice';
import './InvoiceTotals.css';

interface InvoiceTotalsProps {
  invoice: Invoice;
  onUpdate: (updates: Partial<Invoice>) => void;
}

const InvoiceTotals: React.FC<InvoiceTotalsProps> = ({ invoice, onUpdate }) => {
  const [isEditingTax, setIsEditingTax] = useState(false);
  const [isEditingDiscount, setIsEditingDiscount] = useState(false);

  const subtotal = invoice.line_items.reduce(
    (sum, item) => sum + (item.quantity * item.rate),
    0
  );

  const tax = invoice.tax_percent ? subtotal * (invoice.tax_percent / 100) : 0;
  const discount = invoice.discount_percent ? subtotal * (invoice.discount_percent / 100) : 0;
  const total = subtotal + tax - discount;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const handleTaxRateChange = (value: string) => {
    const taxRate = parseFloat(value) || 0;
    onUpdate({ tax_percent: taxRate > 0 ? taxRate : 0 });
  };

  const handleDiscountChange = (value: string) => {
    const discountPercent = parseFloat(value) || 0;
    onUpdate({ discount_percent: discountPercent > 0 ? discountPercent : 0 });
  };

  return (
    <div className="invoice-totals">
      <div className="totals-row">
        <span className="totals-label">Subtotal</span>
        <span className="totals-value">{formatCurrency(subtotal)}</span>
      </div>

      <div className="totals-row">
        <span className="totals-label">
          Tax
          {isEditingTax ? (
            <input
              type="number"
              value={invoice.tax_percent || 0}
              onChange={(e) => handleTaxRateChange(e.target.value)}
              onBlur={() => setIsEditingTax(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingTax(false)}
              min="0"
              max="100"
              step="0.01"
              className="inline-input"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setIsEditingTax(true)}
              className="edit-button"
            >
              ({invoice.tax_percent || 0}%)
            </button>
          )}
        </span>
        <span className="totals-value">
          {tax > 0 ? formatCurrency(tax) : '-'}
        </span>
      </div>

      <div className="totals-row">
        <span className="totals-label">
          Discount
          {isEditingDiscount ? (
            <input
              type="number"
              value={invoice.discount_percent || 0}
              onChange={(e) => handleDiscountChange(e.target.value)}
              onBlur={() => setIsEditingDiscount(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingDiscount(false)}
              min="0"
              max="100"
              step="0.01"
              className="inline-input"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setIsEditingDiscount(true)}
              className="edit-button"
            >
              ({invoice.discount_percent || 0}%)
            </button>
          )}
        </span>
        <span className="totals-value">
          {discount > 0 ? `- ${formatCurrency(discount)}` : '-'}
        </span>
      </div>

      <div className="totals-row total-row">
        <span className="totals-label">Total</span>
        <span className="totals-value total-amount">{formatCurrency(total)}</span>
      </div>

      {invoice.status === 'Paid' && (
        <div className="paid-stamp">PAID</div>
      )}
    </div>
  );
};

export default InvoiceTotals;