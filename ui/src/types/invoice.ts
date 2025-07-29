// Type definitions for the Invoice App
// These match the types defined in the Rust backend

export interface InvoiceSettings {
  invoicer: ContactInfo;
  invoicee: ContactInfo;
  payment_info: string | null;
  payment_image_path: string | null;
  invoice_number_prefix: string;
  next_invoice_number: number;
}

export interface ContactInfo {
  name: string;
  company: string | null;
  address: string;
  email: string | null;
  phone: string | null;
  logo_path: string | null;
}

export interface Invoice {
  id: string;
  number: string;
  name: string | null;
  date: string; // ISO date string
  due_date: string | null;
  invoicer: ContactInfo;
  invoicee: ContactInfo;
  line_items: LineItem[];
  discount_percent: number;
  tax_percent: number;
  notes: string | null;
  payment_info: string | null;
  payment_image_path: string | null;
  status: InvoiceStatus;
  created_at: number;
  updated_at: number;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  discount_percent: number;
  receipt_path: string | null;
}

export interface InvoiceSummary {
  id: string;
  number: string;
  name: string | null;
  date: string;
  total: number;
  status: InvoiceStatus;
}

export enum InvoiceStatus {
  Draft = "Draft",
  Sent = "Sent",
  Paid = "Paid",
  Overdue = "Overdue"
}

// UI State interfaces
export interface InvoiceState {
  // Settings
  settings: InvoiceSettings | null;
  settingsLoading: boolean;
  settingsError: string | null;
  
  // Invoice list
  invoices: InvoiceSummary[];
  invoicesLoading: boolean;
  invoicesError: string | null;
  
  // Current invoice
  currentInvoice: Invoice | null;
  currentInvoiceLoading: boolean;
  currentInvoiceError: string | null;
  
  // UI state
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  autosaveTimer: ReturnType<typeof setTimeout> | null;
}

// Request types for line item operations
export interface UpdateLineItemRequest {
  item_id: string;
  updates: LineItem;
}