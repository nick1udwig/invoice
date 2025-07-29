import { useEffect, useState } from 'react';
import './App.css';
import { useInvoiceStore } from './store/invoice';
import InvoiceList from './components/InvoiceList/InvoiceList';
import SettingsPage from './components/Settings/SettingsPage';
import InvoiceEditor from './components/Invoice/InvoiceEditor';

function App() {
  const [currentView, setCurrentView] = useState<'list' | 'settings' | 'invoice'>('list');
  const { 
    currentInvoice,
    fetchSettings,
    fetchInvoices,
    clearCurrentInvoice
  } = useInvoiceStore();
  
  useEffect(() => {
    // Load initial data
    fetchSettings();
    fetchInvoices();
  }, [fetchSettings, fetchInvoices]);
  
  useEffect(() => {
    // Switch to invoice view when an invoice is loaded
    if (currentInvoice) {
      setCurrentView('invoice');
    }
  }, [currentInvoice]);
  
  const handleBack = () => {
    if (currentView === 'invoice') {
      clearCurrentInvoice();
    }
    setCurrentView('list');
  };
  
  return (
    <div className="app">
      <nav className="navbar">
        <div className="navbar-container">
          <div className="navbar-left">
            <h1 className="app-title">Invoice Manager</h1>
            {currentView !== 'list' && (
              <button onClick={handleBack} className="btn btn-secondary">
                ← Back
              </button>
            )}
          </div>
          <div className="navbar-right">
            {currentView === 'list' && (
              <button 
                onClick={() => setCurrentView('settings')} 
                className="btn btn-secondary"
              >
                Settings
              </button>
            )}
          </div>
        </div>
      </nav>
      
      <main className="main-content">
        {currentView === 'list' && <InvoiceList />}
        {currentView === 'settings' && <SettingsPage onBack={handleBack} />}
        {currentView === 'invoice' && <InvoiceEditor />}
      </main>
    </div>
  );
}

export default App;