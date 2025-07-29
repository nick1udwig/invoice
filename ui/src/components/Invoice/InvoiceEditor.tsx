import React, { useEffect, useState } from 'react';
import { useInvoiceStore } from '../../store/invoice';
import { uploadReceipt } from '../../utils/invoiceApi';
import InvoiceHeader from './InvoiceHeader';
import LineItemTable from './LineItemTable';
import InvoiceTotals from './InvoiceTotals';
import './InvoiceEditor.css';

const InvoiceEditor: React.FC = () => {
  const {
    currentInvoice,
    currentInvoiceLoading,
    currentInvoiceError,
    hasUnsavedChanges,
    canUndo,
    canRedo,
    updateInvoice,
    generatePDF,
    undo,
    redo,
    addLineItem,
    fetchCurrentInvoice
  } = useInvoiceStore();
  
  const [isDraggingOver, setIsDraggingOver] = useState(false);

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
      const path = await generatePDF();
      alert(`PDF generated at: ${path}`);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if we're leaving the editor entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const file = files[0];
    
    if (file && currentInvoice) {
      // Create a new line item
      const newInvoice = await addLineItem();
      
      // Upload receipt to the new line item
      if (newInvoice && newInvoice.line_items.length > 0) {
        const newItem = newInvoice.line_items[newInvoice.line_items.length - 1];
        try {
          await uploadReceipt(newItem.id, file);
          await fetchCurrentInvoice();
        } catch (error) {
          console.error('Failed to upload receipt:', error);
        }
      }
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
    <div 
      className={`invoice-editor ${isDraggingOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="invoice-editor-toolbar">
        <div className="toolbar-left">
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
            Generate PDF
          </button>
        </div>
      </div>

      <div className="invoice-content">
        <InvoiceHeader 
          invoice={currentInvoice}
          onUpdate={updateInvoice}
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