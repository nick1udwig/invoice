import { create } from 'zustand';
import type { InvoiceState, Invoice, InvoiceSettings, LineItem } from '../types/invoice';
import * as invoiceApi from '../utils/invoiceApi';

interface InvoiceStore extends InvoiceState {
  // Settings actions
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: InvoiceSettings) => Promise<void>;
  uploadLogo: (file: File) => Promise<string>;
  uploadPaymentImage: (file: File) => Promise<string>;
  
  // Invoice list actions
  fetchInvoices: () => Promise<void>;
  createInvoice: () => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  
  // Current invoice actions
  loadInvoice: (id: string) => Promise<void>;
  updateInvoice: (updates: Partial<Invoice>) => Promise<void>;
  clearCurrentInvoice: () => void;
  
  // Line item actions
  addLineItem: () => Promise<void>;
  updateLineItem: (itemId: string, updates: Partial<LineItem>) => Promise<void>;
  deleteLineItem: (itemId: string) => Promise<void>;
  reorderLineItems: (itemIds: string[]) => Promise<void>;
  
  // Undo/Redo actions
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  checkUndoRedo: () => Promise<void>;
  
  // PDF actions
  generatePDF: () => Promise<string>;
  
  // Auto-save
  startAutosave: () => void;
  stopAutosave: () => void;
}

export const useInvoiceStore = create<InvoiceStore>((set, get) => ({
  // Initial state
  settings: null,
  settingsLoading: false,
  settingsError: null,
  invoices: [],
  invoicesLoading: false,
  invoicesError: null,
  currentInvoice: null,
  currentInvoiceLoading: false,
  currentInvoiceError: null,
  hasUnsavedChanges: false,
  isSaving: false,
  canUndo: false,
  canRedo: false,
  autosaveTimer: null,
  
  // Settings actions
  fetchSettings: async () => {
    set({ settingsLoading: true, settingsError: null });
    try {
      const settings = await invoiceApi.getSettings();
      set({ settings, settingsLoading: false });
    } catch (error) {
      set({ settingsError: error instanceof Error ? error.message : String(error), settingsLoading: false });
    }
  },
  
  updateSettings: async (settings) => {
    set({ settingsLoading: true, settingsError: null });
    try {
      await invoiceApi.updateSettings(settings);
      set({ settings, settingsLoading: false });
    } catch (error) {
      set({ settingsError: error instanceof Error ? error.message : String(error), settingsLoading: false });
      throw error;
    }
  },
  
  uploadLogo: async (file) => {
    try {
      return await invoiceApi.uploadLogo(file);
    } catch (error) {
      set({ settingsError: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  },
  
  uploadPaymentImage: async (file) => {
    try {
      return await invoiceApi.uploadPaymentImage(file);
    } catch (error) {
      set({ settingsError: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  },
  
  // Invoice list actions
  fetchInvoices: async () => {
    set({ invoicesLoading: true, invoicesError: null });
    try {
      const invoices = await invoiceApi.listInvoices();
      set({ invoices, invoicesLoading: false });
    } catch (error) {
      set({ invoicesError: error instanceof Error ? error.message : String(error), invoicesLoading: false });
    }
  },
  
  createInvoice: async () => {
    set({ currentInvoiceLoading: true, currentInvoiceError: null });
    try {
      const invoice = await invoiceApi.createInvoice();
      const { invoices } = get();
      set({ 
        currentInvoice: invoice,
        currentInvoiceLoading: false,
        invoices: [...invoices, {
          id: invoice.id,
          number: invoice.number,
          name: invoice.name,
          date: invoice.date,
          total: 0,
          status: invoice.status
        }]
      });
      get().startAutosave();
    } catch (error) {
      set({ currentInvoiceError: error instanceof Error ? error.message : String(error), currentInvoiceLoading: false });
      throw error;
    }
  },
  
  deleteInvoice: async (id) => {
    try {
      await invoiceApi.deleteInvoice(id);
      const { invoices, currentInvoice } = get();
      set({ 
        invoices: invoices.filter(inv => inv.id !== id),
        currentInvoice: currentInvoice?.id === id ? null : currentInvoice
      });
      if (currentInvoice?.id === id) {
        get().stopAutosave();
      }
    } catch (error) {
      set({ invoicesError: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  },
  
  // Current invoice actions
  loadInvoice: async (id) => {
    set({ currentInvoiceLoading: true, currentInvoiceError: null });
    try {
      const invoice = await invoiceApi.getInvoice(id);
      set({ currentInvoice: invoice, currentInvoiceLoading: false });
      get().checkUndoRedo();
      get().startAutosave();
    } catch (error) {
      set({ currentInvoiceError: error instanceof Error ? error.message : String(error), currentInvoiceLoading: false });
    }
  },
  
  updateInvoice: async (updates) => {
    const { currentInvoice } = get();
    if (!currentInvoice) return;
    
    try {
      const updatedInvoice = { ...currentInvoice, ...updates };
      const invoice = await invoiceApi.updateInvoice(updatedInvoice);
      set({ 
        currentInvoice: invoice,
        hasUnsavedChanges: true
      });
      get().checkUndoRedo();
      
      // Update invoice in list
      const { invoices } = get();
      const index = invoices.findIndex(inv => inv.id === invoice.id);
      if (index !== -1) {
        const newInvoices = [...invoices];
        newInvoices[index] = {
          id: invoice.id,
          number: invoice.number,
          name: invoice.name,
          date: invoice.date,
          total: invoice.line_items.reduce((sum, item) => {
            const lineTotal = item.quantity * item.rate;
            const lineDiscount = lineTotal * (item.discount_percent / 100);
            return sum + (lineTotal - lineDiscount);
          }, 0),
          status: invoice.status
        };
        set({ invoices: newInvoices });
      }
    } catch (error) {
      set({ currentInvoiceError: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  },
  
  clearCurrentInvoice: () => {
    get().stopAutosave();
    set({ currentInvoice: null, hasUnsavedChanges: false });
  },
  
  // Line item actions
  addLineItem: async () => {
    try {
      const invoice = await invoiceApi.addLineItem();
      set({ currentInvoice: invoice, hasUnsavedChanges: true });
      get().checkUndoRedo();
    } catch (error) {
      set({ currentInvoiceError: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  },
  
  updateLineItem: async (itemId, updates) => {
    const { currentInvoice } = get();
    if (!currentInvoice) return;
    
    const item = currentInvoice.line_items.find(i => i.id === itemId);
    if (!item) return;
    
    try {
      const updatedItem = { ...item, ...updates };
      const invoice = await invoiceApi.updateLineItem(itemId, updatedItem);
      set({ currentInvoice: invoice, hasUnsavedChanges: true });
      get().checkUndoRedo();
    } catch (error) {
      set({ currentInvoiceError: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  },
  
  deleteLineItem: async (itemId) => {
    try {
      const invoice = await invoiceApi.deleteLineItem(itemId);
      set({ currentInvoice: invoice, hasUnsavedChanges: true });
      get().checkUndoRedo();
    } catch (error) {
      set({ currentInvoiceError: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  },
  
  reorderLineItems: async (itemIds) => {
    try {
      const invoice = await invoiceApi.reorderLineItems(itemIds);
      set({ currentInvoice: invoice, hasUnsavedChanges: true });
      get().checkUndoRedo();
    } catch (error) {
      set({ currentInvoiceError: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  },
  
  // Undo/Redo actions
  undo: async () => {
    try {
      const invoice = await invoiceApi.undo();
      set({ currentInvoice: invoice, hasUnsavedChanges: true });
      get().checkUndoRedo();
    } catch (error) {
      console.error('Undo failed:', error);
    }
  },
  
  redo: async () => {
    try {
      const invoice = await invoiceApi.redo();
      set({ currentInvoice: invoice, hasUnsavedChanges: true });
      get().checkUndoRedo();
    } catch (error) {
      console.error('Redo failed:', error);
    }
  },
  
  checkUndoRedo: async () => {
    try {
      const [canUndo, canRedo] = await Promise.all([
        invoiceApi.canUndo(),
        invoiceApi.canRedo()
      ]);
      set({ canUndo, canRedo });
    } catch (error) {
      console.error('Failed to check undo/redo:', error);
    }
  },
  
  // PDF actions
  generatePDF: async () => {
    set({ isSaving: true });
    try {
      const path = await invoiceApi.generatePDF();
      set({ isSaving: false });
      return path;
    } catch (error) {
      set({ isSaving: false, currentInvoiceError: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  },
  
  // Auto-save
  startAutosave: () => {
    const { autosaveTimer } = get();
    if (autosaveTimer) return;
    
    const timer = setInterval(async () => {
      const { hasUnsavedChanges } = get();
      if (hasUnsavedChanges) {
        try {
          const status = await invoiceApi.checkAutosave();
          if (status === 'saved') {
            set({ hasUnsavedChanges: false });
          }
        } catch (error) {
          console.error('Autosave failed:', error);
        }
      }
    }, 1000);
    
    set({ autosaveTimer: timer });
  },
  
  stopAutosave: () => {
    const { autosaveTimer } = get();
    if (autosaveTimer) {
      clearInterval(autosaveTimer);
      set({ autosaveTimer: null });
    }
  }
}));