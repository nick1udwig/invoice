// Invoice API utilities
import * as api from '../../../target/ui/caller-utils';
import type { 
  Invoice, 
  InvoiceSettings, 
  InvoiceSummary, 
  LineItem,
  UpdateLineItemRequest 
} from '../types/invoice';

// Settings Management
export async function getSettings(): Promise<InvoiceSettings | null> {
  try {
    const response = await api.getSettings("");
    return response === "null" ? null : JSON.parse(response);
  } catch (error) {
    console.error('Failed to get settings:', error);
    throw error;
  }
}

export async function updateSettings(settings: InvoiceSettings): Promise<void> {
  try {
    await api.updateSettings(JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to update settings:', error);
    throw error;
  }
}

export async function uploadLogo(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = Array.from(new Uint8Array(buffer));
    return await api.uploadLogo(bytes);
  } catch (error) {
    console.error('Failed to upload logo:', error);
    throw error;
  }
}

export async function uploadPaymentImage(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = Array.from(new Uint8Array(buffer));
    return await api.uploadPaymentImage(bytes);
  } catch (error) {
    console.error('Failed to upload payment image:', error);
    throw error;
  }
}

// Invoice Management
export async function listInvoices(): Promise<InvoiceSummary[]> {
  try {
    const response = await api.listInvoices("");
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to list invoices:', error);
    throw error;
  }
}

export async function createInvoice(): Promise<Invoice> {
  try {
    const response = await api.createInvoice("");
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to create invoice:', error);
    throw error;
  }
}

export async function getInvoice(id: string): Promise<Invoice> {
  try {
    const response = await api.getInvoice(JSON.stringify(id));
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to get invoice:', error);
    throw error;
  }
}

export async function updateInvoice(invoice: Invoice): Promise<Invoice> {
  try {
    const response = await api.updateInvoice(JSON.stringify(invoice));
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to update invoice:', error);
    throw error;
  }
}

export async function deleteInvoice(id: string): Promise<void> {
  try {
    await api.deleteInvoice(JSON.stringify(id));
  } catch (error) {
    console.error('Failed to delete invoice:', error);
    throw error;
  }
}

// Line Item Operations
export async function addLineItem(): Promise<Invoice> {
  try {
    const response = await api.addLineItem("");
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to add line item:', error);
    throw error;
  }
}

export async function updateLineItem(itemId: string, updates: LineItem): Promise<Invoice> {
  try {
    const request: UpdateLineItemRequest = {
      item_id: itemId,
      updates
    };
    const response = await api.updateLineItem(JSON.stringify(request));
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to update line item:', error);
    throw error;
  }
}

export async function deleteLineItem(itemId: string): Promise<Invoice> {
  try {
    const response = await api.deleteLineItem(JSON.stringify(itemId));
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to delete line item:', error);
    throw error;
  }
}

export async function reorderLineItems(itemIds: string[]): Promise<Invoice> {
  try {
    const response = await api.reorderLineItems(JSON.stringify(itemIds));
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to reorder line items:', error);
    throw error;
  }
}

// Undo/Redo Operations
export async function undo(): Promise<Invoice> {
  try {
    const response = await api.undo("");
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to undo:', error);
    throw error;
  }
}

export async function redo(): Promise<Invoice> {
  try {
    const response = await api.redo("");
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to redo:', error);
    throw error;
  }
}

export async function canUndo(): Promise<boolean> {
  try {
    return await api.canUndo("");
  } catch (error) {
    console.error('Failed to check undo:', error);
    throw error;
  }
}

export async function canRedo(): Promise<boolean> {
  try {
    return await api.canRedo("");
  } catch (error) {
    console.error('Failed to check redo:', error);
    throw error;
  }
}

// PDF Generation
export async function generatePDF(): Promise<string> {
  try {
    return await api.generatePdf("");
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    throw error;
  }
}

// Auto-save
export async function checkAutosave(): Promise<string> {
  try {
    return await api.checkAutosave("");
  } catch (error) {
    console.error('Failed to check autosave:', error);
    throw error;
  }
}

// Receipt Management
export async function uploadReceipt(itemId: string, file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = Array.from(new Uint8Array(buffer));
    
    const request = {
      item_id: itemId,
      file_name: file.name,
      file_data: bytes
    };
    
    return await api.uploadReceipt(Array.from(new TextEncoder().encode(JSON.stringify(request))));
  } catch (error) {
    console.error('Failed to upload receipt:', error);
    throw error;
  }
}

export async function getReceipt(receiptPath: string): Promise<Blob> {
  try {
    const bytes = await api.getReceipt(JSON.stringify(receiptPath));
    return new Blob([new Uint8Array(bytes)]);
  } catch (error) {
    console.error('Failed to get receipt:', error);
    throw error;
  }
}