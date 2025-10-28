import React, { useEffect } from 'react';
import { useInvoiceStore } from '../../store/invoice';
import InvoiceHeader from './InvoiceHeader';
import LineItemTable from './LineItemTable';
import InvoiceTotals from './InvoiceTotals';
import './InvoiceEditor.css';

interface InvoiceEditorProps {
  onBack: () => void;
}

const InvoiceEditor: React.FC<InvoiceEditorProps> = ({ onBack }) => {
  const {
    currentInvoice,
    currentInvoiceLoading,
    currentInvoiceError,
    hasUnsavedChanges,
    canUndo,
    canRedo,
    updateInvoice,
    updateInvoiceImmediate,
    generatePDF,
    undo,
    redo,
    addLineItem
  } = useInvoiceStore();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (canRedo) redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  const handleGeneratePDF = async () => {
    try {
      const result = await generatePDF();
      const { html, filename } = JSON.parse(result);
      
      // Create a blob from the HTML content
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      
      // Create a download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      // Trigger the download
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      
    } catch (error) {
      console.error('Failed to generate invoice:', error);
      alert('Failed to generate invoice. Please try again.');
    }
  };


  if (currentInvoiceLoading) {
    return <div className="invoice-editor-loading">Loading invoice...</div>;
  }

  if (currentInvoiceError) {
    return <div className="invoice-editor-error">Error: {currentInvoiceError}</div>;
  }

  if (!currentInvoice) {
    return <div className="invoice-editor-error">No invoice loaded</div>;
  }

  return (
    <div className="invoice-editor">
      <div className="invoice-editor-toolbar">
        <div className="toolbar-left">
          <button 
            onClick={onBack}
            className="btn btn-secondary back-button"
          >
            ← Invoices
          </button>
          <button 
            onClick={undo} 
            disabled={!canUndo}
            className="btn btn-secondary"
            title="Undo (Ctrl+Z)"
          >
            ↶ Undo
          </button>
          <button 
            onClick={redo} 
            disabled={!canRedo}
            className="btn btn-secondary"
            title="Redo (Ctrl+Y)"
          >
            ↷ Redo
          </button>
          {hasUnsavedChanges && (
            <span className="unsaved-indicator">• Unsaved changes</span>
          )}
        </div>
        <div className="toolbar-right">
          <button 
            onClick={handleGeneratePDF}
            className="btn btn-primary"
          >
            Generate Invoice
          </button>
        </div>
      </div>

      <div className="invoice-content">
        <InvoiceHeader 
          invoice={currentInvoice}
          onUpdate={updateInvoice}
          onUpdateImmediate={updateInvoiceImmediate}
        />
        
        <div className="invoice-parties">
          <div className="from-section">
            <h3>From</h3>
            <div className="contact-info">
              <strong>{currentInvoice.invoicer.name}</strong>
              {currentInvoice.invoicer.company && (
                <div>{currentInvoice.invoicer.company}</div>
              )}
              <div className="address">{currentInvoice.invoicer.address}</div>
              {currentInvoice.invoicer.email && (
                <div>{currentInvoice.invoicer.email}</div>
              )}
              {currentInvoice.invoicer.phone && (
                <div>{currentInvoice.invoicer.phone}</div>
              )}
            </div>
          </div>
          
          <div className="to-section">
            <h3>Bill To</h3>
            <div className="contact-info">
              <strong>{currentInvoice.invoicee.name || 'No client selected'}</strong>
              {currentInvoice.invoicee.company && (
                <div>{currentInvoice.invoicee.company}</div>
              )}
              {currentInvoice.invoicee.address && (
                <div className="address">{currentInvoice.invoicee.address}</div>
              )}
              {currentInvoice.invoicee.email && (
                <div>{currentInvoice.invoicee.email}</div>
              )}
              {currentInvoice.invoicee.phone && (
                <div>{currentInvoice.invoicee.phone}</div>
              )}
            </div>
          </div>
        </div>

        <LineItemTable 
          items={currentInvoice.line_items}
          onAddItem={addLineItem}
        />

        <div className="invoice-footer">
          <div className="notes-section">
            <h4>Notes</h4>
            <textarea
              value={currentInvoice.notes || ''}
              onChange={(e) => updateInvoice({ notes: e.target.value || null })}
              placeholder="Add any notes or special instructions..."
              rows={4}
            />
          </div>
          
          <InvoiceTotals 
            invoice={currentInvoice}
            onUpdate={updateInvoice}
          />
        </div>

        {currentInvoice.payment_info && (
          <div className="payment-info">
            <h4>Payment Information</h4>
            <p>{currentInvoice.payment_info}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceEditor;
