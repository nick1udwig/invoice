// Invoice API utilities
import * as api from '../../../target/ui/caller-utils';
import type { 
  Invoice, 
  InvoiceSettings, 
  InvoiceSummary, 
  LineItem,
  UpdateLineItemRequest 
} from '../types/invoice';

const appApi = api.App;

// Settings Management
export async function getSettings(): Promise<InvoiceSettings | null> {
  try {
    const response = await appApi.get_settings();
    return response === "null" ? null : JSON.parse(response);
  } catch (error) {
    console.error('Failed to get settings:', error);
    throw error;
  }
}

export async function updateSettings(settings: InvoiceSettings): Promise<void> {
  try {
    await appApi.update_settings(JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to update settings:', error);
    throw error;
  }
}

export async function uploadLogo(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = Array.from(new Uint8Array(buffer));
    return await appApi.upload_logo(bytes);
  } catch (error) {
    console.error('Failed to upload logo:', error);
    throw error;
  }
}

export async function uploadPaymentImage(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = Array.from(new Uint8Array(buffer));
    return await appApi.upload_payment_image(bytes);
  } catch (error) {
    console.error('Failed to upload payment image:', error);
    throw error;
  }
}

// Invoice Management
export async function listInvoices(): Promise<InvoiceSummary[]> {
  try {
    const response = await appApi.list_invoices();
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to list invoices:', error);
    throw error;
  }
}

export async function createInvoice(): Promise<Invoice> {
  try {
    const response = await appApi.create_invoice();
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to create invoice:', error);
    throw error;
  }
}

export async function getInvoice(id: string): Promise<Invoice> {
  try {
    const response = await appApi.get_invoice(JSON.stringify(id));
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to get invoice:', error);
    throw error;
  }
}

export async function updateInvoice(invoice: Invoice): Promise<Invoice> {
  try {
    const response = await appApi.update_invoice(JSON.stringify(invoice));
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to update invoice:', error);
    throw error;
  }
}

export async function deleteInvoice(id: string): Promise<void> {
  try {
    await appApi.delete_invoice(JSON.stringify(id));
  } catch (error) {
    console.error('Failed to delete invoice:', error);
    throw error;
  }
}

// Line Item Operations
export async function addLineItem(): Promise<Invoice> {
  try {
    const response = await appApi.add_line_item();
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
    const response = await appApi.update_line_item(JSON.stringify(request));
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to update line item:', error);
    throw error;
  }
}

export async function deleteLineItem(itemId: string): Promise<Invoice> {
  try {
    const response = await appApi.delete_line_item(JSON.stringify(itemId));
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to delete line item:', error);
    throw error;
  }
}

export async function reorderLineItems(itemIds: string[]): Promise<Invoice> {
  try {
    const response = await appApi.reorder_line_items(JSON.stringify(itemIds));
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to reorder line items:', error);
    throw error;
  }
}

// Undo/Redo Operations
export async function undo(): Promise<Invoice> {
  try {
    const response = await appApi.undo();
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to undo:', error);
    throw error;
  }
}

export async function redo(): Promise<Invoice> {
  try {
    const response = await appApi.redo();
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to redo:', error);
    throw error;
  }
}

export async function canUndo(): Promise<boolean> {
  try {
    return await appApi.can_undo();
  } catch (error) {
    console.error('Failed to check undo:', error);
    throw error;
  }
}

export async function canRedo(): Promise<boolean> {
  try {
    return await appApi.can_redo();
  } catch (error) {
    console.error('Failed to check redo:', error);
    throw error;
  }
}

// PDF Generation
export async function generatePDF(): Promise<string> {
  try {
    return await appApi.generate_pdf();
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    throw error;
  }
}

// Auto-save
export async function checkAutosave(): Promise<string> {
  try {
    return await appApi.check_autosave();
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
    
    return await appApi.upload_receipt(Array.from(new TextEncoder().encode(JSON.stringify(request))));
  } catch (error) {
    console.error('Failed to upload receipt:', error);
    throw error;
  }
}

export async function getReceipt(receiptPath: string): Promise<number[]> {
  try {
    const bytes = await appApi.get_receipt(JSON.stringify(receiptPath));
    return bytes;
  } catch (error) {
    console.error('Failed to get receipt:', error);
    throw error;
  }
}
