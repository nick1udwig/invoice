import React, { useState, useEffect } from 'react';
import { useInvoiceStore } from '../../store/invoice';
import type { InvoiceSettings, ContactInfo } from '../../types/invoice';
import './SettingsPage.css';

interface SettingsPageProps {
  onBack: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
  const {
    settings,
    settingsLoading,
    settingsError,
    updateSettings,
    uploadLogo,
    uploadPaymentImage
  } = useInvoiceStore();

  const [formData, setFormData] = useState<InvoiceSettings>({
    invoicer: {
      name: '',
      company: null,
      address: '',
      email: null,
      phone: null,
      logo_path: null
    },
    invoicee: {
      name: '',
      company: null,
      address: '',
      email: null,
      phone: null,
      logo_path: null
    },
    payment_info: null,
    payment_image_path: null,
    invoice_number_prefix: 'INV-',
    next_invoice_number: 1
  });

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleContactChange = (
    type: 'invoicer' | 'invoicee',
    field: keyof ContactInfo,
    value: string
  ) => {
    setFormData(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value || null
      }
    }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const path = await uploadLogo(file);
      setFormData(prev => ({
        ...prev,
        invoicer: {
          ...prev.invoicer,
          logo_path: path
        }
      }));
    } catch (error) {
      console.error('Failed to upload logo:', error);
    }
  };

  const handlePaymentImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const path = await uploadPaymentImage(file);
      setFormData(prev => ({
        ...prev,
        payment_image_path: path
      }));
    } catch (error) {
      console.error('Failed to upload payment image:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettings(formData);
      onBack();
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  if (settingsLoading && !settings) {
    return <div className="settings-loading">Loading settings...</div>;
  }

  return (
    <div className="settings-container">
      <h2>Invoice Settings</h2>
      {settingsError && (
        <div className="settings-error">{settingsError}</div>
      )}
      
      <form onSubmit={handleSubmit} className="settings-form">
        <section className="settings-section">
          <h3>Your Business Information</h3>
          
          <div className="form-group">
            <label htmlFor="invoicer-name">Business Name *</label>
            <input
              id="invoicer-name"
              type="text"
              value={formData.invoicer.name}
              onChange={(e) => handleContactChange('invoicer', 'name', e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="invoicer-company">Company (optional)</label>
            <input
              id="invoicer-company"
              type="text"
              value={formData.invoicer.company || ''}
              onChange={(e) => handleContactChange('invoicer', 'company', e.target.value)}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="invoicer-address">Address *</label>
            <textarea
              id="invoicer-address"
              value={formData.invoicer.address}
              onChange={(e) => handleContactChange('invoicer', 'address', e.target.value)}
              rows={3}
              required
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="invoicer-email">Email</label>
              <input
                id="invoicer-email"
                type="email"
                value={formData.invoicer.email || ''}
                onChange={(e) => handleContactChange('invoicer', 'email', e.target.value)}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="invoicer-phone">Phone</label>
              <input
                id="invoicer-phone"
                type="tel"
                value={formData.invoicer.phone || ''}
                onChange={(e) => handleContactChange('invoicer', 'phone', e.target.value)}
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="logo-upload">Logo</label>
            <input
              id="logo-upload"
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
            />
            {formData.invoicer.logo_path && (
              <p className="file-path">Current: {formData.invoicer.logo_path}</p>
            )}
          </div>
        </section>

        <section className="settings-section">
          <h3>Default Client Information</h3>
          
          <div className="form-group">
            <label htmlFor="invoicee-name">Client Name</label>
            <input
              id="invoicee-name"
              type="text"
              value={formData.invoicee.name}
              onChange={(e) => handleContactChange('invoicee', 'name', e.target.value)}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="invoicee-company">Company</label>
            <input
              id="invoicee-company"
              type="text"
              value={formData.invoicee.company || ''}
              onChange={(e) => handleContactChange('invoicee', 'company', e.target.value)}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="invoicee-address">Address</label>
            <textarea
              id="invoicee-address"
              value={formData.invoicee.address}
              onChange={(e) => handleContactChange('invoicee', 'address', e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="invoicee-email">Email</label>
              <input
                id="invoicee-email"
                type="email"
                value={formData.invoicee.email || ''}
                onChange={(e) => handleContactChange('invoicee', 'email', e.target.value)}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="invoicee-phone">Phone</label>
              <input
                id="invoicee-phone"
                type="tel"
                value={formData.invoicee.phone || ''}
                onChange={(e) => handleContactChange('invoicee', 'phone', e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h3>Invoice Configuration</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="invoice-prefix">Invoice Number Prefix</label>
              <input
                id="invoice-prefix"
                type="text"
                value={formData.invoice_number_prefix}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  invoice_number_prefix: e.target.value
                }))}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="next-number">Next Invoice Number</label>
              <input
                id="next-number"
                type="number"
                min="1"
                value={formData.next_invoice_number}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  next_invoice_number: parseInt(e.target.value) || 1
                }))}
                required
              />
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h3>Payment Information</h3>
          
          <div className="form-group">
            <label htmlFor="payment-info">Payment Instructions</label>
            <textarea
              id="payment-info"
              value={formData.payment_info || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                payment_info: e.target.value || null
              }))}
              rows={4}
              placeholder="e.g., Bank account details, payment terms, etc."
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="payment-image">Payment QR Code / Image</label>
            <input
              id="payment-image"
              type="file"
              accept="image/*"
              onChange={handlePaymentImageUpload}
            />
            {formData.payment_image_path && (
              <p className="file-path">Current: {formData.payment_image_path}</p>
            )}
          </div>
        </section>

        <div className="form-actions">
          <button type="button" onClick={onBack} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={settingsLoading}>
            {settingsLoading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsPage;