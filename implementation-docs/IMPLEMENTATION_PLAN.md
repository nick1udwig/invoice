# Invoice Hyperware App Implementation Plan

## Overview

This document provides a comprehensive implementation plan for building an invoice-making Hyperware application. The app will have two main pages: a settings/splash page and an invoice editing page. All data will be persisted using VFS with automatic saving and undo/redo functionality.

## Architecture Overview

### Technology Stack
- **Backend**: Rust with Hyperware process framework
- **Frontend**: React with TypeScript, Vite, and Zustand for state management
- **Persistence**: VFS (Virtual File System) with JSON storage
- **PDF Generation**: HTML to PDF conversion using appropriate libraries

### Development Workflow
1. Define data models and backend logic in Rust
2. Build the app with `kit build --hyperapp` to generate API bindings
3. Implement frontend UI consuming the generated API
4. Iterate with backend changes → regenerate API → update frontend

## Phase 1: Backend Implementation (Rust)

### 1.1 Data Models

Replace the example `AppState` in `skeleton-app/src/lib.rs` with the following structures:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppState {
    pub settings: InvoiceSettings,
    pub invoices: Vec<InvoiceSummary>,
    pub current_invoice: Option<Invoice>,
    pub undo_stack: Vec<InvoiceSnapshot>,
    pub redo_stack: Vec<InvoiceSnapshot>,
    pub last_save_time: u64,
    pub has_unsaved_changes: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceSettings {
    pub invoicer: ContactInfo,
    pub invoicee: ContactInfo,
    pub payment_info: Option<String>,
    pub payment_image_path: Option<String>,
    pub invoice_number_prefix: String,
    pub next_invoice_number: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContactInfo {
    pub name: String,
    pub company: Option<String>,
    pub address: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub logo_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Invoice {
    pub id: String,
    pub number: String,
    pub name: Option<String>,
    pub date: String, // ISO date string
    pub due_date: Option<String>,
    pub invoicer: ContactInfo,
    pub invoicee: ContactInfo,
    pub line_items: Vec<LineItem>,
    pub discount_percent: f64,
    pub tax_percent: f64,
    pub notes: Option<String>,
    pub payment_info: Option<String>,
    pub payment_image_path: Option<String>,
    pub status: InvoiceStatus,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineItem {
    pub id: String,
    pub description: String,
    pub quantity: f64,
    pub rate: f64,
    pub discount_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceSummary {
    pub id: String,
    pub number: String,
    pub name: Option<String>,
    pub date: String,
    pub total: f64,
    pub status: InvoiceStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum InvoiceStatus {
    Draft,
    Sent,
    Paid,
    Overdue,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceSnapshot {
    pub invoice: Invoice,
    pub timestamp: u64,
}
```

### 1.2 VFS Structure

Initialize the following VFS structure in the `#[init]` function:

```
/invoice:publisher.os/invoice/
├── settings.json                    # Global invoice settings
├── 2024-03-15/                     # Date-based directories
│   ├── INV-001/                    # Invoice number directory
│   │   ├── invoice.json            # Invoice data
│   │   └── invoice.pdf             # Generated PDF
│   └── Project-ABC/                # Named invoice directory
│       ├── invoice.json
│       └── invoice.pdf
└── 2024-03-16/
    └── INV-002/
        ├── invoice.json
        └── invoice.pdf
```

### 1.3 Backend Functions

Implement the following `#[http]` annotated functions:

#### Settings Management
```rust
#[http]
pub fn get_settings(_request_body: Vec<u8>) -> Result<InvoiceSettings, String>

#[http]
pub fn update_settings(_request_body: Vec<u8>) -> Result<(), String>
// Parse request body to InvoiceSettings

#[http]
pub fn upload_logo(_request_body: Vec<u8>) -> Result<String, String>
// Save image to VFS, return path

#[http]
pub fn upload_payment_image(_request_body: Vec<u8>) -> Result<String, String>
// Save payment QR code/image to VFS, return path
```

#### Invoice Management
```rust
#[http]
pub fn list_invoices(_request_body: Vec<u8>) -> Result<Vec<InvoiceSummary>, String>
// Read all invoice directories and return summaries

#[http]
pub fn create_invoice(_request_body: Vec<u8>) -> Result<Invoice, String>
// Create new invoice with auto-generated number

#[http]
pub fn get_invoice(_request_body: Vec<u8>) -> Result<Invoice, String>
// Parse request body to get invoice ID

#[http]
pub fn update_invoice(_request_body: Vec<u8>) -> Result<Invoice, String>
// Update invoice and trigger auto-save

#[http]
pub fn delete_invoice(_request_body: Vec<u8>) -> Result<(), String>
// Remove invoice directory

#[http]
pub fn rename_invoice(_request_body: Vec<u8>) -> Result<Invoice, String>
// Handle directory renaming

#[http]
pub fn duplicate_invoice(_request_body: Vec<u8>) -> Result<Invoice, String>
// Create copy with new number
```

#### Line Item Operations
```rust
#[http]
pub fn add_line_item(_request_body: Vec<u8>) -> Result<Invoice, String>

#[http]
pub fn update_line_item(_request_body: Vec<u8>) -> Result<Invoice, String>

#[http]
pub fn delete_line_item(_request_body: Vec<u8>) -> Result<Invoice, String>

#[http]
pub fn reorder_line_items(_request_body: Vec<u8>) -> Result<Invoice, String>
```

#### Undo/Redo
```rust
#[http]
pub fn undo(_request_body: Vec<u8>) -> Result<Invoice, String>

#[http]
pub fn redo(_request_body: Vec<u8>) -> Result<Invoice, String>

#[http]
pub fn can_undo(_request_body: Vec<u8>) -> Result<bool, String>

#[http]
pub fn can_redo(_request_body: Vec<u8>) -> Result<bool, String>
```

#### PDF Generation
```rust
#[http]
pub fn generate_pdf(_request_body: Vec<u8>) -> Result<String, String>
// Generate PDF from invoice data, return VFS path
```

### 1.4 Implementation Details

#### Auto-save Logic
- Implement a timer that checks `has_unsaved_changes` every second
- If true and 1 second has passed since last edit, save to VFS
- Update `last_save_time` after successful save

#### VFS Operations
Use the VFS bindings from `hyperware_process_lib::vfs`:
```rust
// Initialize invoice drive
create_drive(state.our.package_id, "invoice", Some(5))?;

// Save invoice
let path = format!("/invoice/{}/{}/invoice.json", date, invoice_name);
let file = create_file(&path, Some(5))?;
file.write(&serde_json::to_vec(&invoice)?)?;

// Read invoice
let file = open_file(&path, false, Some(5))?;
let data = file.read_to_string()?;
let invoice: Invoice = serde_json::from_str(&data)?;
```

#### Directory Management
- When renaming: check if new directory exists, create if needed, move files
- When changing date: similar process with date directories
- Use `open_dir()` and `read()` to list invoices

#### Undo/Redo Implementation
- Before any modification, push current state to undo stack
- Clear redo stack on new changes
- Limit stack size to prevent memory issues (e.g., 50 entries)

## Phase 2: Frontend Implementation (React/TypeScript)

### 2.1 Component Structure

```
ui/src/
├── components/
│   ├── Settings/
│   │   ├── SettingsForm.tsx
│   │   ├── ContactInfoForm.tsx
│   │   └── LogoUpload.tsx
│   ├── Invoice/
│   │   ├── InvoiceEditor.tsx
│   │   ├── InvoiceHeader.tsx
│   │   ├── LineItemTable.tsx
│   │   ├── LineItemRow.tsx
│   │   └── InvoiceTotals.tsx
│   ├── Common/
│   │   ├── Navigation.tsx
│   │   ├── LoadingSpinner.tsx
│   │   └── ErrorBoundary.tsx
│   └── InvoiceList/
│       ├── InvoiceList.tsx
│       └── InvoiceCard.tsx
├── store/
│   ├── settings.ts
│   ├── invoice.ts
│   └── ui.ts
├── utils/
│   ├── api.ts         # Generated API calls
│   ├── calculations.ts # Line item calculations
│   └── formatting.ts   # Number/date formatting
└── App.tsx
```

### 2.2 State Management (Zustand)

#### Settings Store
```typescript
interface SettingsStore {
  settings: InvoiceSettings | null;
  loading: boolean;
  error: string | null;
  
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: InvoiceSettings) => Promise<void>;
  uploadLogo: (file: File) => Promise<string>;
  uploadPaymentImage: (file: File) => Promise<string>;
}
```

#### Invoice Store
```typescript
interface InvoiceStore {
  invoices: InvoiceSummary[];
  currentInvoice: Invoice | null;
  loading: boolean;
  error: string | null;
  autoSaveTimer: NodeJS.Timeout | null;
  
  fetchInvoices: () => Promise<void>;
  createInvoice: () => Promise<void>;
  loadInvoice: (id: string) => Promise<void>;
  updateInvoice: (updates: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  
  // Line items
  addLineItem: () => Promise<void>;
  updateLineItem: (id: string, updates: Partial<LineItem>) => Promise<void>;
  deleteLineItem: (id: string) => Promise<void>;
  
  // Undo/Redo
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  
  // PDF
  generatePDF: () => Promise<string>;
}
```

### 2.3 UI Components

#### Settings Page
- Form with sections for invoicer and invoicee info
- File upload components for logo and payment image
- Preview of uploaded images
- Save button with loading state

#### Invoice List
- Grid or list view of invoice cards
- Each card shows: number, name, date, total, status
- Click to edit, hover for quick actions
- Search/filter functionality
- "Create New Invoice" button

#### Invoice Editor
- Header with invoice number, name (editable), and dates
- Contact info display (non-editable, from settings)
- Line items table with inline editing
- Add line item button
- Totals section showing:
  - Subtotal
  - Discount amount
  - Tax amount
  - Total
- Action buttons: Save, Generate PDF, Undo, Redo, Back

#### Line Item Row
- Inline editable fields for:
  - Description (text input)
  - Quantity (number input)
  - Rate (currency input)
  - Discount % (percentage input)
  - Line total (calculated, read-only)
- Delete button
- Drag handle for reordering

### 2.4 Auto-save Implementation

```typescript
// In invoice store
useEffect(() => {
  if (currentInvoice && hasUnsavedChanges) {
    const timer = setTimeout(() => {
      saveInvoice();
    }, 1000);
    
    return () => clearTimeout(timer);
  }
}, [currentInvoice, hasUnsavedChanges]);
```

### 2.5 Styling Considerations

- Use the existing CSS framework from skeleton app
- Ensure invoice editor looks like the final invoice
- Print-friendly styles for PDF generation
- Responsive design for mobile viewing
- Visual feedback for auto-save status

## Phase 3: PDF Generation

### 3.1 Approach

Two options for PDF generation:

#### Option 1: Server-side HTML to PDF
- Generate HTML template in Rust
- Use a WASM-compatible PDF library
- Store generated PDF in VFS

#### Option 2: Client-side Generation
- Use a library like jsPDF or react-pdf
- Generate on frontend, upload to backend
- More flexibility for styling

Recommended: Start with Option 1 for simplicity

### 3.2 HTML Template

Create an HTML template that matches the invoice editor layout:
- Company logos and branding
- Invoice details and dates
- Itemized table
- Totals and payment info
- Professional typography and spacing

## Phase 4: Testing and Refinement

### 4.1 Test Scenarios

1. **Data Persistence**
   - Create invoice, refresh page, verify data persists
   - Auto-save during editing
   - Directory management on rename/date change

2. **Calculations**
   - Line item totals
   - Discounts at line and invoice level
   - Tax calculations

3. **Undo/Redo**
   - Multiple undo/redo operations
   - State consistency after undo/redo

4. **Edge Cases**
   - Large number of line items
   - Long descriptions
   - Concurrent editing (if supported)

### 4.2 Performance Optimization

- Debounce auto-save to prevent excessive writes
- Lazy load invoice list for large datasets
- Optimize PDF generation for large invoices

## Implementation Notes

### Important Reminders

1. **DO NOT create the API manually** - The API is machine-generated when you run `kit build --hyperapp`

2. **Follow the backend → API → frontend workflow** for all changes

3. **Use the VFS examples** from the provided resources, particularly from the file-explorer app

4. **Reference the skeleton app** for patterns on:
   - HTTP endpoint structure
   - State management
   - Error handling
   - UI component organization

5. **Test incrementally** - Build and test each major feature before moving to the next

### Resources to Reference

- `/resources/example-apps/file-explorer/` - For comprehensive VFS usage
- `/resources/guides/ui-frontend.md` - For React/TypeScript patterns
- `/resources/guides/wit-types-data-modeling.md` - For understanding type limitations
- The skeleton app comments - They contain crucial information about Hyperware patterns

### Development Commands

```bash
# Build the hyperapp (generates API)
kit build --hyperapp

# Run the UI development server
cd ui && npm run dev

# Build UI for production
cd ui && npm run build:copy

# Deploy the app
kit install /path/to/built/app
```

This plan provides a comprehensive roadmap for implementing the invoice app. Start with Phase 1 (backend), ensuring all data models and API endpoints are properly defined before moving to the frontend implementation.