// INVOICE HYPERWARE APP
// A comprehensive invoice management application for the Hyperware platform

// CRITICAL IMPORTS - DO NOT MODIFY THESE
// The hyperprocess_macro provides everything you need including:
// - Async/await support (custom runtime)
// - Automatic WIT (WebAssembly Interface Types) generation
// - State persistence
// - HTTP/WebSocket bindings
use hyperprocess_macro::*;

use hyperware_app_common::SaveOptions;

// HYPERWARE PROCESS LIB IMPORTS
// These are provided by the hyperprocess_macro, DO NOT add hyperware_process_lib to Cargo.toml
use hyperware_process_lib::{
    our,                    // Gets current node/process identity
    homepage::add_to_homepage,  // Adds app icon to Hyperware homepage
    vfs::{self, create_drive, create_file, open_file, open_dir, remove_file}, // VFS operations
};

// Standard imports for serialization
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use base64::{Engine as _, engine::general_purpose};

// Invoice Data Models

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InvoiceSettings {
    pub invoicer: ContactInfo,
    pub invoicee: ContactInfo,
    pub payment_info: Option<String>,
    pub payment_image_path: Option<String>,
    pub invoice_number_prefix: String,
    pub next_invoice_number: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContactInfo {
    pub name: String,
    pub company: Option<String>,
    pub address: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub logo_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LineItem {
    pub id: String,
    pub description: String,
    pub quantity: f64,
    pub rate: f64,
    pub discount_percent: f64,
    pub receipt_path: Option<String>, // Path to receipt file in VFS
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InvoiceSummary {
    pub id: String,
    pub number: String,
    pub name: Option<String>,
    pub date: String,
    pub total: f64,
    pub status: InvoiceStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
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

// STEP 1: DEFINE YOUR APP STATE
// This struct holds all persistent data for your app
// It MUST derive Default, Serialize, and Deserialize
#[derive(Default, Serialize, Deserialize)]
pub struct AppState {
    pub settings: Option<InvoiceSettings>,
    pub invoices: HashMap<String, InvoiceSummary>, // Key is invoice ID
    pub current_invoice: Option<Invoice>,
    pub undo_stack: Vec<InvoiceSnapshot>,
    pub redo_stack: Vec<InvoiceSnapshot>,
    pub last_save_time: u64,
    pub has_unsaved_changes: bool,
}

// STEP 2: IMPLEMENT YOUR APP LOGIC
// The #[hyperprocess] attribute goes HERE, before the impl block
#[hyperprocess(
    // App name shown in the UI and logs
    name = "Invoice",

    // Enable UI serving at root path
    ui = Some(HttpBindingConfig::default()),

    // HTTP API endpoints - MUST include /api for frontend communication
    endpoints = vec![
        Binding::Http {
            path: "/api",
            config: HttpBindingConfig::new(false, false, false, None)
        }
    ],

    // State persistence options - save every 5 seconds
    save_config = SaveOptions::OnDiff,

    // WIT world name - must match package naming convention
    wit_world = "invoice-os-v0"
)]
impl AppState {
    // INITIALIZATION FUNCTION
    // Runs once when your process starts
    #[init]
    async fn initialize(&mut self) {
        // Add your app to the Hyperware homepage
        add_to_homepage("Invoice", Some("📄"), Some("/"), None);

        // Get our node identity
        let our_node = our().node.clone();
        println!("Invoice app initialized on node: {}", our_node);

        // Create the invoice VFS drive
        let package_id = our().package_id();
        match create_drive(package_id, "invoice", Some(5)) {
            Ok(drive_path) => {
                println!("Created invoice drive at: {}", drive_path);

                // Load settings if they exist
                let settings_path = format!("{}/settings.json", drive_path);
                match open_file(&settings_path, false, Some(5)) {
                    Ok(file) => {
                        match file.read_to_string() {
                            Ok(data) => {
                                if let Ok(settings) = serde_json::from_str::<InvoiceSettings>(&data) {
                                    self.settings = Some(settings);
                                    println!("Loaded existing settings");
                                }
                            }
                            Err(_) => println!("No existing settings found"),
                        }
                    }
                    Err(_) => println!("No settings file found"),
                }

                // Load invoice summaries
                self.load_invoice_summaries(&drive_path);
            }
            Err(e) => {
                println!("Failed to create invoice drive: {:?}", e);
            }
        }
    }

    // Settings Management Endpoints

    #[http]
    async fn get_settings(&self) -> Result<String, String> {
        match &self.settings {
            Some(settings) => serde_json::to_string(settings)
                .map_err(|e| format!("Failed to serialize settings: {}", e)),
            None => Ok("null".to_string()),
        }
    }

    #[http]
    async fn update_settings(&mut self, request_body: String) -> Result<String, String> {
        let settings: InvoiceSettings = serde_json::from_str(&request_body)
            .map_err(|e| format!("Invalid settings: {}", e))?;

        self.settings = Some(settings.clone());

        // Save settings to VFS
        let package_id = our().package_id();
        let drive_path = format!("/{}/invoice", package_id);
        let settings_path = format!("{}/settings.json", drive_path);

        match create_file(&settings_path, Some(5)) {
            Ok(file) => {
                let data = serde_json::to_vec(&settings)
                    .map_err(|e| format!("Failed to serialize settings: {}", e))?;
                file.write(&data)
                    .map_err(|e| format!("Failed to write settings: {}", e))?;
                Ok("Settings updated".to_string())
            }
            Err(e) => Err(format!("Failed to create settings file: {}", e)),
        }
    }

    #[http]
    async fn upload_logo(&mut self, request_body: Vec<u8>) -> Result<String, String> {
        let package_id = our().package_id();
        let drive_path = format!("/{}/invoice", package_id);
        let logo_path = format!("{}/logo.png", drive_path);

        match create_file(&logo_path, Some(5)) {
            Ok(file) => {
                file.write(&request_body)
                    .map_err(|e| format!("Failed to write logo: {}", e))?;
                Ok(logo_path)
            }
            Err(e) => Err(format!("Failed to create logo file: {}", e)),
        }
    }

    #[http]
    async fn upload_payment_image(&mut self, request_body: Vec<u8>) -> Result<String, String> {
        let package_id = our().package_id();
        let drive_path = format!("/{}/invoice", package_id);
        let payment_path = format!("{}/payment.png", drive_path);

        match create_file(&payment_path, Some(5)) {
            Ok(file) => {
                file.write(&request_body)
                    .map_err(|e| format!("Failed to write payment image: {}", e))?;
                Ok(payment_path)
            }
            Err(e) => Err(format!("Failed to create payment image file: {}", e)),
        }
    }

    // Invoice Management Endpoints

    #[http]
    async fn list_invoices(&self) -> Result<String, String> {
        let summaries: Vec<InvoiceSummary> = self.invoices.values().cloned().collect();
        serde_json::to_string(&summaries)
            .map_err(|e| format!("Failed to serialize invoices: {}", e))
    }

    #[http]
    async fn create_invoice(&mut self) -> Result<String, String> {
        // Get current timestamp
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Generate invoice number
        let invoice_number = if let Some(ref mut settings) = self.settings {
            let number = format!("{}{:04}", settings.invoice_number_prefix, settings.next_invoice_number);
            settings.next_invoice_number += 1;
            
            // Save updated settings to VFS
            let package_id = our().package_id();
            let drive_path = format!("/{}/invoice", package_id);
            let settings_path = format!("{}/settings.json", drive_path);
            
            if let Ok(file) = create_file(&settings_path, Some(5)) {
                if let Ok(data) = serde_json::to_vec(&settings) {
                    let _ = file.write(&data);
                }
            }
            
            number
        } else {
            format!("INV-{:04}", self.invoices.len() + 1)
        };

        // Generate unique ID
        let id = format!("{}-{}", timestamp, invoice_number);

        // Get current date
        // Get current date - simple approximation for YYYY-MM-DD
        let date = {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            // Simple date calculation (not accurate for all cases, but works for demo)
            let days_since_epoch = now / 86400;
            let year = 1970 + (days_since_epoch / 365) as u32;
            let month = ((days_since_epoch % 365) / 30) as u32 + 1;
            let day = ((days_since_epoch % 365) % 30) as u32 + 1;
            format!("{:04}-{:02}-{:02}", year, month, day)
        };

        // Create new invoice
        let invoice = Invoice {
            id: id.clone(),
            number: invoice_number.clone(),
            name: None,
            date: date.clone(),
            due_date: None,
            invoicer: self.settings.as_ref().map(|s| s.invoicer.clone())
                .unwrap_or(ContactInfo {
                    name: String::new(),
                    company: None,
                    address: String::new(),
                    email: None,
                    phone: None,
                    logo_path: None,
                }),
            invoicee: self.settings.as_ref().map(|s| s.invoicee.clone())
                .unwrap_or(ContactInfo {
                    name: String::new(),
                    company: None,
                    address: String::new(),
                    email: None,
                    phone: None,
                    logo_path: None,
                }),
            line_items: vec![],
            discount_percent: 0.0,
            tax_percent: 0.0,
            notes: None,
            payment_info: self.settings.as_ref().and_then(|s| s.payment_info.clone()),
            payment_image_path: self.settings.as_ref().and_then(|s| s.payment_image_path.clone()),
            status: InvoiceStatus::Draft,
            created_at: timestamp,
            updated_at: timestamp,
        };

        // Set as current invoice
        self.current_invoice = Some(invoice.clone());
        self.has_unsaved_changes = true;

        // Add to summaries
        let summary = InvoiceSummary {
            id: invoice.id.clone(),
            number: invoice.number.clone(),
            name: invoice.name.clone(),
            date: invoice.date.clone(),
            total: 0.0,
            status: invoice.status.clone(),
        };
        self.invoices.insert(invoice.id.clone(), summary);

        // Save invoice
        self.save_current_invoice()?;

        serde_json::to_string(&invoice)
            .map_err(|e| format!("Failed to serialize invoice: {}", e))
    }

    #[http]
    async fn get_invoice(&mut self, request_body: String) -> Result<String, String> {
        let id: String = serde_json::from_str(&request_body)
            .map_err(|e| format!("Invalid invoice ID: {}", e))?;

        // Check if it's already the current invoice
        if let Some(ref current) = self.current_invoice {
            if current.id == id {
                return serde_json::to_string(current)
                    .map_err(|e| format!("Failed to serialize invoice: {}", e));
            }
        }

        // Load invoice from VFS
        let package_id = our().package_id();
        let drive_path = format!("/{}/invoice", package_id);

        // Find the invoice in any date directory
        match self.invoices.get(&id) {
            Some(summary) => {
                let date = &summary.date;
                let invoice_dir = if let Some(name) = &summary.name {
                    name.clone()
                } else {
                    summary.number.clone()
                };

                let invoice_path = format!("{}/{}/{}/invoice.json", drive_path, date, invoice_dir);
                match open_file(&invoice_path, false, Some(5)) {
                    Ok(file) => {
                        match file.read_to_string() {
                            Ok(data) => {
                                let invoice: Invoice = serde_json::from_str(&data)
                                    .map_err(|e| format!("Failed to parse invoice: {}", e))?;
                                self.current_invoice = Some(invoice.clone());
                                serde_json::to_string(&invoice)
                                    .map_err(|e| format!("Failed to serialize invoice: {}", e))
                            }
                            Err(e) => Err(format!("Failed to read invoice: {}", e)),
                        }
                    }
                    Err(e) => Err(format!("Invoice not found: {}", e)),
                }
            }
            None => Err("Invoice not found".to_string()),
        }
    }

    #[http]
    async fn update_invoice(&mut self, request_body: String) -> Result<String, String> {
        let updates: Invoice = serde_json::from_str(&request_body)
            .map_err(|e| format!("Invalid invoice data: {}", e))?;

        // Update timestamp
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Push current state to undo stack if there is one
        if let Some(ref current) = self.current_invoice {
            if current.id == updates.id {
                let snapshot = InvoiceSnapshot {
                    invoice: current.clone(),
                    timestamp: current.updated_at,
                };
                self.undo_stack.push(snapshot);

                // Limit undo stack size
                if self.undo_stack.len() > 50 {
                    self.undo_stack.remove(0);
                }

                // Clear redo stack on new change
                self.redo_stack.clear();
            }
        }

        // Update invoice
        let mut updated_invoice = updates;
        updated_invoice.updated_at = timestamp;

        self.current_invoice = Some(updated_invoice.clone());
        self.has_unsaved_changes = true;

        // Update summary
        let summary = InvoiceSummary {
            id: updated_invoice.id.clone(),
            number: updated_invoice.number.clone(),
            name: updated_invoice.name.clone(),
            date: updated_invoice.date.clone(),
            total: calculate_invoice_total(&updated_invoice),
            status: updated_invoice.status.clone(),
        };
        self.invoices.insert(updated_invoice.id.clone(), summary);

        // Auto-save after 1 second
        self.last_save_time = timestamp;
        self.save_current_invoice()?;

        serde_json::to_string(&updated_invoice)
            .map_err(|e| format!("Failed to serialize invoice: {}", e))
    }

    #[http]
    async fn delete_invoice(&mut self, request_body: String) -> Result<String, String> {
        let id: String = serde_json::from_str(&request_body)
            .map_err(|e| format!("Invalid invoice ID: {}", e))?;

        // Remove from summaries
        if let Some(summary) = self.invoices.remove(&id) {
            // Delete from VFS
            let package_id = our().package_id();
            let drive_path = format!("/{}/invoice", package_id);
            let invoice_dir = if let Some(name) = &summary.name {
                name.clone()
            } else {
                summary.number.clone()
            };

            let invoice_path = format!("{}/{}/{}/invoice.json", drive_path, summary.date, invoice_dir);
            let _ = remove_file(&invoice_path, Some(5));

            // Clear current invoice if it's the deleted one
            if let Some(ref current) = self.current_invoice {
                if current.id == id {
                    self.current_invoice = None;
                }
            }

            Ok("Invoice deleted".to_string())
        } else {
            Err("Invoice not found".to_string())
        }
    }

    // Line Item Operations

    #[http]
    async fn add_line_item(&mut self) -> Result<String, String> {
        if let Some(ref mut invoice) = self.current_invoice {
            // Save current state for undo
            let snapshot = InvoiceSnapshot {
                invoice: invoice.clone(),
                timestamp: invoice.updated_at,
            };
            self.undo_stack.push(snapshot);
            if self.undo_stack.len() > 50 {
                self.undo_stack.remove(0);
            }
            self.redo_stack.clear();

            // Create new line item
            let id = format!("item-{}", std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis());
            let new_item = LineItem {
                id,
                description: String::new(),
                quantity: 1.0,
                rate: 0.0,
                discount_percent: 0.0,
                receipt_path: None,
            };

            invoice.line_items.push(new_item);
            invoice.updated_at = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();

            self.has_unsaved_changes = true;

            // Update summary
            let total = calculate_invoice_total(&invoice.clone());
            let summary = InvoiceSummary {
                id: invoice.id.clone(),
                number: invoice.number.clone(),
                name: invoice.name.clone(),
                date: invoice.date.clone(),
                total,
                status: invoice.status.clone(),
            };
            self.invoices.insert(invoice.id.clone(), summary);

            serde_json::to_string(invoice)
                .map_err(|e| format!("Failed to serialize invoice: {}", e))
        } else {
            Err("No invoice currently loaded".to_string())
        }
    }

    #[http]
    async fn update_line_item(&mut self, request_body: String) -> Result<String, String> {
        #[derive(Deserialize)]
        struct UpdateLineItemRequest {
            item_id: String,
            updates: LineItem,
        }

        let req: UpdateLineItemRequest = serde_json::from_str(&request_body)
            .map_err(|e| format!("Invalid request: {}", e))?;

        if let Some(ref mut invoice) = self.current_invoice {
            // Save current state for undo
            let snapshot = InvoiceSnapshot {
                invoice: invoice.clone(),
                timestamp: invoice.updated_at,
            };
            self.undo_stack.push(snapshot);
            if self.undo_stack.len() > 50 {
                self.undo_stack.remove(0);
            }
            self.redo_stack.clear();

            // Find and update line item
            if let Some(item) = invoice.line_items.iter_mut().find(|i| i.id == req.item_id) {
                *item = req.updates;
            } else {
                return Err("Line item not found".to_string());
            }

            invoice.updated_at = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();

            self.has_unsaved_changes = true;

            // Update summary
            let total = calculate_invoice_total(&invoice.clone());
            let summary = InvoiceSummary {
                id: invoice.id.clone(),
                number: invoice.number.clone(),
                name: invoice.name.clone(),
                date: invoice.date.clone(),
                total,
                status: invoice.status.clone(),
            };
            self.invoices.insert(invoice.id.clone(), summary);

            serde_json::to_string(invoice)
                .map_err(|e| format!("Failed to serialize invoice: {}", e))
        } else {
            Err("No invoice currently loaded".to_string())
        }
    }

    #[http]
    async fn delete_line_item(&mut self, request_body: String) -> Result<String, String> {
        let item_id: String = serde_json::from_str(&request_body)
            .map_err(|e| format!("Invalid item ID: {}", e))?;

        if let Some(ref mut invoice) = self.current_invoice {
            // Save current state for undo
            let snapshot = InvoiceSnapshot {
                invoice: invoice.clone(),
                timestamp: invoice.updated_at,
            };
            self.undo_stack.push(snapshot);
            if self.undo_stack.len() > 50 {
                self.undo_stack.remove(0);
            }
            self.redo_stack.clear();

            // Remove line item
            invoice.line_items.retain(|item| item.id != item_id);

            invoice.updated_at = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();

            self.has_unsaved_changes = true;

            // Update summary
            let total = calculate_invoice_total(&invoice.clone());
            let summary = InvoiceSummary {
                id: invoice.id.clone(),
                number: invoice.number.clone(),
                name: invoice.name.clone(),
                date: invoice.date.clone(),
                total,
                status: invoice.status.clone(),
            };
            self.invoices.insert(invoice.id.clone(), summary);

            serde_json::to_string(invoice)
                .map_err(|e| format!("Failed to serialize invoice: {}", e))
        } else {
            Err("No invoice currently loaded".to_string())
        }
    }

    #[http]
    async fn reorder_line_items(&mut self, request_body: String) -> Result<String, String> {
        let item_ids: Vec<String> = serde_json::from_str(&request_body)
            .map_err(|e| format!("Invalid item IDs: {}", e))?;

        if let Some(ref mut invoice) = self.current_invoice {
            // Save current state for undo
            let snapshot = InvoiceSnapshot {
                invoice: invoice.clone(),
                timestamp: invoice.updated_at,
            };
            self.undo_stack.push(snapshot);
            if self.undo_stack.len() > 50 {
                self.undo_stack.remove(0);
            }
            self.redo_stack.clear();

            // Reorder line items
            let mut new_items = Vec::new();
            for id in item_ids {
                if let Some(item) = invoice.line_items.iter().find(|i| i.id == id) {
                    new_items.push(item.clone());
                }
            }
            invoice.line_items = new_items;

            invoice.updated_at = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();

            self.has_unsaved_changes = true;

            serde_json::to_string(invoice)
                .map_err(|e| format!("Failed to serialize invoice: {}", e))
        } else {
            Err("No invoice currently loaded".to_string())
        }
    }

    // Receipt Upload
    
    #[http]
    async fn upload_receipt(&mut self, request_body: Vec<u8>) -> Result<String, String> {
        #[derive(Deserialize)]
        struct ReceiptUploadRequest {
            item_id: String,
            file_name: String,
            file_data: Vec<u8>,
        }
        
        let request: ReceiptUploadRequest = serde_json::from_slice(&request_body)
            .map_err(|e| format!("Invalid request: {}", e))?;
        
        if let Some(ref mut invoice) = self.current_invoice {
            // Find the line item
            let item_index = invoice.line_items.iter().position(|item| item.id == request.item_id)
                .ok_or("Line item not found")?;
            
            // Save current state for undo
            let snapshot = InvoiceSnapshot {
                invoice: invoice.clone(),
                timestamp: invoice.updated_at,
            };
            self.undo_stack.push(snapshot);
            if self.undo_stack.len() > 50 {
                self.undo_stack.remove(0);
            }
            self.redo_stack.clear();
            
            // Save receipt file to VFS
            let package_id = our().package_id();
            let drive_path = format!("/{}/invoice", package_id);
            
            // Create receipts directory for this invoice
            let invoice_dir = if let Some(ref name) = invoice.name {
                name.clone()
            } else {
                invoice.number.clone()
            };
            
            let receipts_dir = format!("{}/{}/{}/receipts", drive_path, invoice.date, invoice_dir);
            let _ = open_dir(&receipts_dir, true, Some(5));
            
            // Save the receipt file
            let receipt_path = format!("{}/{}", receipts_dir, request.file_name);
            match create_file(&receipt_path, Some(5)) {
                Ok(file) => {
                    file.write(&request.file_data)
                        .map_err(|e| format!("Failed to write receipt: {}", e))?;
                    
                    // Update the line item with the receipt path
                    invoice.line_items[item_index].receipt_path = Some(receipt_path.clone());
                    
                    // If the line item description is empty or default, use the filename without extension
                    if invoice.line_items[item_index].description.is_empty() || 
                       invoice.line_items[item_index].description == "Click to add description" {
                        let file_stem = request.file_name
                            .rsplit('.')
                            .skip(1)
                            .collect::<Vec<_>>()
                            .into_iter()
                            .rev()
                            .collect::<Vec<_>>()
                            .join(".");
                        let file_stem = if file_stem.is_empty() { 
                            request.file_name.clone() 
                        } else { 
                            file_stem 
                        };
                        invoice.line_items[item_index].description = file_stem;
                    }
                    
                    invoice.updated_at = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs();
                    
                    self.has_unsaved_changes = true;
                    self.save_current_invoice()?;
                    
                    // Return the path
                    Ok(receipt_path)
                }
                Err(e) => Err(format!("Failed to create receipt file: {}", e)),
            }
        } else {
            Err("No invoice currently loaded".to_string())
        }
    }
    
    #[http]
    async fn get_receipt(&self, request_body: String) -> Result<Vec<u8>, String> {
        let receipt_path: String = serde_json::from_str(&request_body)
            .map_err(|e| format!("Invalid receipt path: {}", e))?;
        
        match open_file(&receipt_path, false, Some(5)) {
            Ok(file) => {
                file.read()
                    .map_err(|e| format!("Failed to read receipt: {}", e))
            }
            Err(e) => Err(format!("Receipt not found: {}", e)),
        }
    }

    // Undo/Redo Operations

    #[http]
    async fn undo(&mut self) -> Result<String, String> {
        if let Some(snapshot) = self.undo_stack.pop() {
            // Save current state to redo stack
            if let Some(ref current) = self.current_invoice {
                let redo_snapshot = InvoiceSnapshot {
                    invoice: current.clone(),
                    timestamp: current.updated_at,
                };
                self.redo_stack.push(redo_snapshot);
            }

            // Restore from undo stack
            self.current_invoice = Some(snapshot.invoice.clone());
            self.has_unsaved_changes = true;

            // Update summary
            let summary = InvoiceSummary {
                id: snapshot.invoice.id.clone(),
                number: snapshot.invoice.number.clone(),
                name: snapshot.invoice.name.clone(),
                date: snapshot.invoice.date.clone(),
                total: calculate_invoice_total(&snapshot.invoice),
                status: snapshot.invoice.status.clone(),
            };
            self.invoices.insert(snapshot.invoice.id.clone(), summary);

            serde_json::to_string(&snapshot.invoice)
                .map_err(|e| format!("Failed to serialize invoice: {}", e))
        } else {
            Err("Nothing to undo".to_string())
        }
    }

    #[http]
    async fn redo(&mut self) -> Result<String, String> {
        if let Some(snapshot) = self.redo_stack.pop() {
            // Save current state to undo stack
            if let Some(ref current) = self.current_invoice {
                let undo_snapshot = InvoiceSnapshot {
                    invoice: current.clone(),
                    timestamp: current.updated_at,
                };
                self.undo_stack.push(undo_snapshot);
            }

            // Restore from redo stack
            self.current_invoice = Some(snapshot.invoice.clone());
            self.has_unsaved_changes = true;

            // Update summary
            let summary = InvoiceSummary {
                id: snapshot.invoice.id.clone(),
                number: snapshot.invoice.number.clone(),
                name: snapshot.invoice.name.clone(),
                date: snapshot.invoice.date.clone(),
                total: calculate_invoice_total(&snapshot.invoice),
                status: snapshot.invoice.status.clone(),
            };
            self.invoices.insert(snapshot.invoice.id.clone(), summary);

            serde_json::to_string(&snapshot.invoice)
                .map_err(|e| format!("Failed to serialize invoice: {}", e))
        } else {
            Err("Nothing to redo".to_string())
        }
    }

    #[http]
    async fn can_undo(&self) -> Result<bool, String> {
        Ok(!self.undo_stack.is_empty())
    }

    #[http]
    async fn can_redo(&self) -> Result<bool, String> {
        Ok(!self.redo_stack.is_empty())
    }

    // PDF Generation

    #[http]
    async fn generate_pdf(&mut self) -> Result<String, String> {
        if let Some(ref invoice) = self.current_invoice {
            // Generate HTML for the invoice
            let html = self.generate_invoice_html(invoice);

            // Save the HTML to VFS
            let package_id = our().package_id();
            let drive_path = format!("/{}/invoice", package_id);

            let invoice_dir = if let Some(ref name) = invoice.name {
                name.clone()
            } else {
                invoice.number.clone()
            };

            let html_path = format!("{}/{}/{}/invoice.html", drive_path, invoice.date, invoice_dir);
            match create_file(&html_path, Some(5)) {
                Ok(file) => {
                    file.write(html.as_bytes())
                        .map_err(|e| format!("Failed to write HTML: {}", e))?;
                    
                    // Return both the path and the HTML content as JSON
                    let response = serde_json::json!({
                        "path": html_path,
                        "html": html,
                        "filename": format!("invoice_{}.html", invoice.number)
                    });
                    serde_json::to_string(&response)
                        .map_err(|e| format!("Failed to serialize response: {}", e))
                }
                Err(e) => Err(format!("Failed to create invoice file: {}", e)),
            }
        } else {
            Err("No invoice currently loaded".to_string())
        }
    }

    // Auto-save timer method
    #[http]
    async fn check_autosave(&mut self) -> Result<String, String> {
        if self.has_unsaved_changes {
            let current_time = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();

            if current_time - self.last_save_time >= 1 {
                self.save_current_invoice()?;
                self.last_save_time = current_time;
                Ok("saved".to_string())
            } else {
                Ok("waiting".to_string())
            }
        } else {
            Ok("no_changes".to_string())
        }
    }
}

// Standalone helper function for calculating invoice total
fn calculate_invoice_total(invoice: &Invoice) -> f64 {
    let mut subtotal = 0.0;

    for item in &invoice.line_items {
        let line_total = item.quantity * item.rate;
        let line_discount = line_total * (item.discount_percent / 100.0);
        subtotal += line_total - line_discount;
    }

    let invoice_discount = subtotal * (invoice.discount_percent / 100.0);
    let after_discount = subtotal - invoice_discount;
    let tax = after_discount * (invoice.tax_percent / 100.0);

    after_discount + tax
}

// Helper methods implementation
impl AppState {
    // Helper method to load invoice summaries
    fn load_invoice_summaries(&mut self, drive_path: &str) {
        match open_dir(drive_path, false, Some(5)) {
            Ok(dir) => {
                if let Ok(entries) = dir.read() {
                    for entry in entries {
                        if entry.file_type == vfs::FileType::Directory {
                            self.load_invoices_from_date_dir(&format!("{}/{}", drive_path, entry.path));
                        }
                    }
                }
            }
            Err(_) => println!("Could not open drive directory"),
        }
    }

    // Helper method to load invoices from a date directory
    fn load_invoices_from_date_dir(&mut self, date_dir_path: &str) {
        match open_dir(date_dir_path, false, Some(5)) {
            Ok(dir) => {
                if let Ok(entries) = dir.read() {
                    for entry in entries {
                        if entry.file_type == vfs::FileType::Directory {
                            let invoice_path = format!("{}/{}/invoice.json", date_dir_path, entry.path);
                            if let Ok(file) = open_file(&invoice_path, false, Some(5)) {
                                if let Ok(data) = file.read_to_string() {
                                    if let Ok(invoice) = serde_json::from_str::<Invoice>(&data) {
                                        let summary = InvoiceSummary {
                                            id: invoice.id.clone(),
                                            number: invoice.number.clone(),
                                            name: invoice.name.clone(),
                                            date: invoice.date.clone(),
                                            total: calculate_invoice_total(&invoice),
                                            status: invoice.status.clone(),
                                        };
                                        self.invoices.insert(invoice.id.clone(), summary);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Err(_) => {}
        }
    }


    // Helper method to save current invoice
    fn save_current_invoice(&mut self) -> Result<(), String> {
        if let Some(ref invoice) = self.current_invoice {
            let package_id = our().package_id();
            let drive_path = format!("/{}/invoice", package_id);

            // Create date directory
            let date_dir = format!("{}/{}", drive_path, invoice.date);
            let _ = open_dir(&date_dir, true, Some(5));

            // Determine the invoice directory name
            let invoice_dir_name = if let Some(ref name) = invoice.name {
                if !name.is_empty() {
                    name.clone()
                } else {
                    invoice.number.clone()
                }
            } else {
                invoice.number.clone()
            };
            
            // Check if we need to rename the directory (if the name changed)
            // For now, we'll just save to the new location
            // In production, you'd want to move the old directory
            
            let invoice_dir = format!("{}/{}", date_dir, invoice_dir_name);
            let _ = open_dir(&invoice_dir, true, Some(5));

            // Save invoice.json
            let invoice_path = format!("{}/invoice.json", invoice_dir);
            match create_file(&invoice_path, Some(5)) {
                Ok(file) => {
                    let data = serde_json::to_vec(invoice)
                        .map_err(|e| format!("Failed to serialize invoice: {}", e))?;
                    file.write(&data)
                        .map_err(|e| format!("Failed to write invoice: {}", e))?;
                    self.has_unsaved_changes = false;
                    Ok(())
                }
                Err(e) => Err(format!("Failed to create invoice file: {}", e)),
            }
        } else {
            Ok(())
        }
    }

    // Helper method to generate invoice HTML with embedded receipts
    fn generate_invoice_html(&self, invoice: &Invoice) -> String {
        let subtotal = invoice.line_items.iter()
            .map(|item| {
                let line_total = item.quantity * item.rate;
                line_total - (line_total * item.discount_percent / 100.0)
            })
            .sum::<f64>();

        let invoice_discount = subtotal * invoice.discount_percent / 100.0;
        let after_discount = subtotal - invoice_discount;
        let tax = after_discount * invoice.tax_percent / 100.0;
        let total = after_discount + tax;

        // Generate logo HTML if available
        let logo_html = if let Some(ref logo_path) = invoice.invoicer.logo_path {
            if let Ok(file) = open_file(logo_path, false, Some(5)) {
                if let Ok(data) = file.read() {
                    let mime_type = if logo_path.ends_with(".png") {
                        "image/png"
                    } else if logo_path.ends_with(".jpg") || logo_path.ends_with(".jpeg") {
                        "image/jpeg"
                    } else {
                        "image/png" // default
                    };
                    let base64_data = general_purpose::STANDARD.encode(&data);
                    format!(r#"<img src="data:{};base64,{}" alt="Company Logo" style="max-height: 80px; margin-bottom: 1rem; display: block;" />"#, mime_type, base64_data)
                } else {
                    String::new()
                }
            } else {
                String::new()
            }
        } else {
            String::new()
        };

        // Collect all receipt data for embedding
        let mut embedded_receipts = String::new();
        for (index, item) in invoice.line_items.iter().enumerate() {
            if let Some(ref receipt_path) = item.receipt_path {
                if let Ok(file) = open_file(receipt_path, false, Some(5)) {
                    if let Ok(data) = file.read() {
                        let mime_type = if receipt_path.ends_with(".pdf") {
                            "application/pdf"
                        } else if receipt_path.ends_with(".jpg") || receipt_path.ends_with(".jpeg") {
                            "image/jpeg"
                        } else if receipt_path.ends_with(".png") {
                            "image/png"
                        } else {
                            "application/octet-stream"
                        };
                        
                        // Convert to base64
                        let base64_data = general_purpose::STANDARD.encode(&data);
                        embedded_receipts.push_str(&format!(
                            r#"<div id="receipt-{}" style="display:none;" data-mime="{}" data-filename="{}">{}</div>"#,
                            index,
                            mime_type,
                            receipt_path.split('/').last().unwrap_or("receipt"),
                            base64_data
                        ));
                    }
                }
            }
        }

        format!(r#"
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; background-color: #f5f5dc; color: #333; }}
        .header {{ display: flex; justify-content: space-between; margin-bottom: 40px; }}
        .invoice-details {{ text-align: right; }}
        .contact-info {{ margin-bottom: 30px; }}
        table {{ width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #fffef9; }}
        th, td {{ padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }}
        th {{ background-color: #ede8d5; }}
        .totals {{ text-align: right; margin-top: 20px; }}
        .total-row {{ display: flex; justify-content: flex-end; margin: 5px 0; }}
        .total-label {{ width: 150px; }}
        .total-value {{ width: 100px; text-align: right; }}
        .receipt-link {{ color: #4a6fa5; text-decoration: underline; cursor: pointer; font-size: 0.9em; }}
        .receipt-link:hover {{ color: #2e4a7c; }}
        .modal {{ display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.9); }}
        .modal-content {{ margin: 2% auto; display: block; max-width: 90%; max-height: 90%; }}
        .close {{ position: absolute; top: 15px; right: 35px; color: #f1f1f1; font-size: 40px; font-weight: bold; cursor: pointer; }}
        .close:hover {{ color: #bbb; }}
        @media print {{
            .receipt-link {{ display: none; }}
            body {{ background-color: white; }}
            table {{ background-color: white; }}
            th {{ background-color: #f5f5f5; }}
        }}
    </style>
</head>
<body>
    <div class="header">
        <div class="invoicer">
            {}
            <h2>{}</h2>
            <div class="contact-info">
                <p>{}</p>
                <p>{}</p>
                <p>{}</p>
            </div>
        </div>
        <div class="invoice-details">
            <h1>INVOICE</h1>
            <p><strong>Invoice #:</strong> {}</p>
            <p><strong>Date:</strong> {}</p>
            <p><strong>Due Date:</strong> {}</p>
        </div>
    </div>

    <div class="invoicee">
        <h3>Bill To:</h3>
        <div class="contact-info">
            <p><strong>{}</strong></p>
            <p>{}</p>
            <p>{}</p>
            <p>{}</p>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Rate</th>
                <th>Discount</th>
                <th>Amount</th>
                <th>Receipt</th>
            </tr>
        </thead>
        <tbody>
            {}
        </tbody>
    </table>

    <div class="totals">
        <div class="total-row">
            <span class="total-label">Subtotal:</span>
            <span class="total-value">${:.2}</span>
        </div>
        <div class="total-row">
            <span class="total-label">Discount ({}%):</span>
            <span class="total-value">-${:.2}</span>
        </div>
        <div class="total-row">
            <span class="total-label">Tax ({}%):</span>
            <span class="total-value">${:.2}</span>
        </div>
        <div class="total-row" style="font-weight: bold; font-size: 1.2em;">
            <span class="total-label">Total:</span>
            <span class="total-value">${:.2}</span>
        </div>
    </div>

    {}

    {}

    <!-- Embedded receipt data -->
    {}

    <!-- Receipt viewer modal -->
    <div id="receiptModal" class="modal">
        <span class="close" onclick="closeModal()">&times;</span>
        <iframe id="receiptFrame" class="modal-content" style="width: 90%; height: 90%; border: none;"></iframe>
    </div>

    <script>
        function showReceipt(index) {{
            const receiptDiv = document.getElementById('receipt-' + index);
            if (!receiptDiv) return;
            
            const base64Data = receiptDiv.textContent;
            const mimeType = receiptDiv.getAttribute('data-mime');
            const dataUri = 'data:' + mimeType + ';base64,' + base64Data;
            
            const modal = document.getElementById('receiptModal');
            const frame = document.getElementById('receiptFrame');
            frame.src = dataUri;
            modal.style.display = 'block';
        }}
        
        function closeModal() {{
            const modal = document.getElementById('receiptModal');
            const frame = document.getElementById('receiptFrame');
            modal.style.display = 'none';
            frame.src = '';
        }}
        
        window.onclick = function(event) {{
            const modal = document.getElementById('receiptModal');
            if (event.target === modal) {{
                closeModal();
            }}
        }}
    </script>
</body>
</html>
        "#,
            logo_html,
            invoice.invoicer.name,
            invoice.invoicer.company.as_ref().unwrap_or(&String::new()),
            invoice.invoicer.address,
            invoice.invoicer.email.as_ref().unwrap_or(&String::new()),
            invoice.number,
            invoice.date,
            invoice.due_date.as_ref().unwrap_or(&String::new()),
            invoice.invoicee.name,
            invoice.invoicee.company.as_ref().unwrap_or(&String::new()),
            invoice.invoicee.address,
            invoice.invoicee.email.as_ref().unwrap_or(&String::new()),
            invoice.line_items.iter().enumerate()
                .map(|(index, item)| {
                    let line_total = item.quantity * item.rate;
                    let amount = line_total - (line_total * item.discount_percent / 100.0);
                    let receipt_cell = if item.receipt_path.is_some() {
                        format!(r#"<a class="receipt-link" onclick="showReceipt({})">View Receipt</a>"#, index)
                    } else {
                        String::new()
                    };
                    format!(
                        "<tr><td>{}</td><td>{}</td><td>${:.2}</td><td>{}%</td><td>${:.2}</td><td>{}</td></tr>",
                        item.description, item.quantity, item.rate, item.discount_percent, amount, receipt_cell
                    )
                })
                .collect::<Vec<_>>()
                .join("\n"),
            subtotal,
            invoice.discount_percent,
            invoice_discount,
            invoice.tax_percent,
            tax,
            total,
            invoice.notes.as_ref()
                .map(|n| format!("<div class='notes'><h3>Notes:</h3><p>{}</p></div>", n))
                .unwrap_or_default(),
            {
                let mut payment_html = String::new();
                if let Some(ref payment_info) = invoice.payment_info {
                    payment_html.push_str(&format!("<div class='payment'><h3>Payment Information:</h3><p>{}</p>", payment_info));
                    
                    // Add payment image if available
                    if let Some(ref payment_image_path) = invoice.payment_image_path {
                        if let Ok(file) = open_file(payment_image_path, false, Some(5)) {
                            if let Ok(data) = file.read() {
                                let mime_type = if payment_image_path.ends_with(".png") {
                                    "image/png"
                                } else if payment_image_path.ends_with(".jpg") || payment_image_path.ends_with(".jpeg") {
                                    "image/jpeg"
                                } else {
                                    "image/png"
                                };
                                let base64_data = general_purpose::STANDARD.encode(&data);
                                payment_html.push_str(&format!(
                                    r#"<img src="data:{};base64,{}" alt="Payment QR Code" style="max-width: 200px; margin-top: 1rem; display: block;" />"#,
                                    mime_type, base64_data
                                ));
                            }
                        }
                    }
                    payment_html.push_str("</div>");
                }
                payment_html
            },
            embedded_receipts
        )
    }
}
