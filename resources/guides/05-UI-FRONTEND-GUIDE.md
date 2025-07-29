# 💻 UI/Frontend Development Guide

## Frontend Stack Overview

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Zustand** - State management
- **Vite** - Build tool
- **CSS Modules** or plain CSS - Styling

## Critical Setup Requirements

### 1. The `/our.js` Script (MANDATORY)

```html
<!-- ui/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <!-- ⚠️ CRITICAL: Must be FIRST script -->
    <script src="/our.js"></script>
    
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Hyperware App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 2. Global Types Setup

```typescript
// src/types/global.ts
declare global {
  interface Window {
    our?: {
      node: string;       // e.g., "alice.os"
      process: string;    // e.g., "myapp:myapp:publisher.os"
    };
  }
}

export const BASE_URL = '';  // Empty in production

export const isHyperwareEnvironment = (): boolean => {
  return typeof window !== 'undefined' && window.our !== undefined;
};

export const getNodeId = (): string | null => {
  return window.our?.node || null;
};
```

## API Communication Patterns

### 1. Basic API Service

```typescript
// src/utils/api.ts
import { BASE_URL } from '../types/global';

// Generic API call function
export async function makeApiCall<TRequest, TResponse>(
  method: string,
  data?: TRequest
): Promise<TResponse> {
  const body = data !== undefined 
    ? { [method]: data }
    : { [method]: "" };  // Empty string for no params

  const response = await fetch(`${BASE_URL}/api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Typed API methods
export const api = {
  // No parameters
  async getStatus() {
    return makeApiCall<string, StatusResponse>('GetStatus', "");
  },

  // Single parameter
  async getItem(id: string) {
    return makeApiCall<string, Item>('GetItem', id);
  },

  // Multiple parameters (tuple format)
  async createItem(name: string, description: string) {
    return makeApiCall<[string, string], CreateResponse>(
      'CreateItem', 
      [name, description]
    );
  },

  // Complex object (send as JSON string)
  async updateSettings(settings: Settings) {
    return makeApiCall<string, string>(
      'UpdateSettings',
      JSON.stringify(settings)
    );
  },
};
```

### 2. Error Handling

```typescript
// src/utils/errors.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

// Wrapper with error handling
export async function apiCallWithRetry<T>(
  apiCall: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: unknown;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, i) * 1000)
        );
      }
    }
  }
  
  throw lastError;
}
```

## State Management with Zustand

### 1. Store Structure

```typescript
// src/store/app.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface AppState {
  // Connection
  nodeId: string | null;
  isConnected: boolean;
  
  // Data
  items: Item[];
  currentItem: Item | null;
  
  // UI State
  isLoading: boolean;
  error: string | null;
  
  // Filters/Settings
  filters: {
    search: string;
    category: string | null;
    sortBy: 'name' | 'date' | 'priority';
  };
}

interface AppActions {
  // Connection
  initialize: () => void;
  
  // Data operations
  fetchItems: () => Promise<void>;
  createItem: (data: CreateItemData) => Promise<void>;
  updateItem: (id: string, updates: Partial<Item>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  selectItem: (id: string | null) => void;
  
  // UI operations
  setError: (error: string | null) => void;
  clearError: () => void;
  setFilter: (filter: Partial<AppState['filters']>) => void;
  
  // P2P operations
  syncWithNode: (nodeId: string) => Promise<void>;
}

export const useAppStore = create<AppState & AppActions>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        nodeId: null,
        isConnected: false,
        items: [],
        currentItem: null,
        isLoading: false,
        error: null,
        filters: {
          search: '',
          category: null,
          sortBy: 'name',
        },

        // Actions
        initialize: () => {
          const nodeId = getNodeId();
          set(state => {
            state.nodeId = nodeId;
            state.isConnected = nodeId !== null;
          });
          
          if (nodeId) {
            get().fetchItems();
          }
        },

        fetchItems: async () => {
          set(state => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const items = await api.getItems();
            set(state => {
              state.items = items;
              state.isLoading = false;
            });
          } catch (error) {
            set(state => {
              state.error = getErrorMessage(error);
              state.isLoading = false;
            });
          }
        },

        createItem: async (data) => {
          set(state => { state.isLoading = true; });

          try {
            const response = await api.createItem(data);
            
            // Optimistic update
            const newItem: Item = {
              id: response.id,
              ...data,
              createdAt: new Date().toISOString(),
            };
            
            set(state => {
              state.items.push(newItem);
              state.currentItem = newItem;
              state.isLoading = false;
            });
            
            // Refresh to ensure consistency
            await get().fetchItems();
          } catch (error) {
            set(state => {
              state.error = getErrorMessage(error);
              state.isLoading = false;
            });
            throw error; // Re-throw for form handling
          }
        },

        // ... other actions
      })),
      {
        name: 'app-storage',
        partialize: (state) => ({
          // Only persist UI preferences, not data
          filters: state.filters,
        }),
      }
    )
  )
);

// Selector hooks
export const useItems = () => {
  const { items, filters } = useAppStore();
  
  return items.filter(item => {
    if (filters.search && !item.name.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.category && item.category !== filters.category) {
      return false;
    }
    return true;
  }).sort((a, b) => {
    switch (filters.sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'date':
        return b.createdAt.localeCompare(a.createdAt);
      case 'priority':
        return b.priority - a.priority;
    }
  });
};

export const useCurrentItem = () => useAppStore(state => state.currentItem);
export const useIsLoading = () => useAppStore(state => state.isLoading);
export const useError = () => useAppStore(state => state.error);
```

### 2. React Components

```typescript
// src/components/ItemList.tsx
import React, { useEffect } from 'react';
import { useAppStore, useItems } from '../store/app';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';

export const ItemList: React.FC = () => {
  const items = useItems();
  const { isLoading, error, selectItem, currentItem } = useAppStore();

  if (error) return <ErrorMessage error={error} />;
  if (isLoading && items.length === 0) return <LoadingSpinner />;

  return (
    <div className="item-list">
      {items.map(item => (
        <div
          key={item.id}
          className={`item ${currentItem?.id === item.id ? 'selected' : ''}`}
          onClick={() => selectItem(item.id)}
        >
          <h3>{item.name}</h3>
          <p>{item.description}</p>
          <span className="date">
            {new Date(item.createdAt).toLocaleDateString()}
          </span>
        </div>
      ))}
      
      {items.length === 0 && (
        <div className="empty-state">
          <p>No items found</p>
          <button onClick={() => /* open create modal */}>
            Create your first item
          </button>
        </div>
      )}
    </div>
  );
};
```

### 3. Forms with Validation

```typescript
// src/components/CreateItemForm.tsx
import React, { useState } from 'react';
import { useAppStore } from '../store/app';

interface FormData {
  name: string;
  description: string;
  category: string;
}

interface FormErrors {
  name?: string;
  description?: string;
  category?: string;
}

export const CreateItemForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { createItem, isLoading } = useAppStore();
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    category: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length < 3) {
      newErrors.name = 'Name must be at least 3 characters';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (!formData.category) {
      newErrors.category = 'Please select a category';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setSubmitError(null);
    
    try {
      await createItem(formData);
      onClose();
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  };

  const handleChange = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="create-form">
      <h2>Create New Item</h2>
      
      {submitError && (
        <div className="error-banner">{submitError}</div>
      )}
      
      <div className="form-group">
        <label htmlFor="name">Name *</label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={handleChange('name')}
          className={errors.name ? 'error' : ''}
          disabled={isLoading}
        />
        {errors.name && <span className="error-text">{errors.name}</span>}
      </div>
      
      <div className="form-group">
        <label htmlFor="description">Description *</label>
        <textarea
          id="description"
          value={formData.description}
          onChange={handleChange('description')}
          className={errors.description ? 'error' : ''}
          rows={4}
          disabled={isLoading}
        />
        {errors.description && (
          <span className="error-text">{errors.description}</span>
        )}
      </div>
      
      <div className="form-group">
        <label htmlFor="category">Category *</label>
        <select
          id="category"
          value={formData.category}
          onChange={handleChange('category')}
          className={errors.category ? 'error' : ''}
          disabled={isLoading}
        >
          <option value="">Select a category</option>
          <option value="work">Work</option>
          <option value="personal">Personal</option>
          <option value="other">Other</option>
        </select>
        {errors.category && (
          <span className="error-text">{errors.category}</span>
        )}
      </div>
      
      <div className="form-actions">
        <button type="button" onClick={onClose} disabled={isLoading}>
          Cancel
        </button>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Item'}
        </button>
      </div>
    </form>
  );
};
```

## Real-time Updates (Polling Pattern)

Since WebSockets aren't fully supported yet, use polling:

```typescript
// src/hooks/usePolling.ts
import { useEffect, useRef } from 'react';

export function usePolling(
  callback: () => void | Promise<void>,
  interval: number,
  enabled: boolean = true
) {
  const savedCallback = useRef(callback);
  
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);
  
  useEffect(() => {
    if (!enabled) return;
    
    const tick = () => {
      savedCallback.current();
    };
    
    // Call immediately
    tick();
    
    const id = setInterval(tick, interval);
    return () => clearInterval(id);
  }, [interval, enabled]);
}

// Usage in component
export const LiveDataView: React.FC = () => {
  const { fetchUpdates, isConnected } = useAppStore();
  
  // Poll every 2 seconds when connected
  usePolling(
    async () => {
      try {
        await fetchUpdates();
      } catch (error) {
        console.error('Polling error:', error);
      }
    },
    2000,
    isConnected
  );
  
  return <div>...</div>;
};
```

## Common UI Patterns

### 1. Connection Status Banner

```typescript
// src/components/ConnectionStatus.tsx
export const ConnectionStatus: React.FC = () => {
  const { isConnected, nodeId } = useAppStore();
  
  if (!isConnected) {
    return (
      <div className="connection-banner error">
        <span>⚠️ Not connected to Hyperware</span>
      </div>
    );
  }
  
  return (
    <div className="connection-banner success">
      <span>✅ Connected as {nodeId}</span>
    </div>
  );
};
```

### 2. Modal System

```typescript
// src/components/Modal.tsx
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  children, 
  title 
}) => {
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      
      // Close on escape
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {title && (
          <div className="modal-header">
            <h2>{title}</h2>
            <button className="close-button" onClick={onClose}>
              ×
            </button>
          </div>
        )}
        <div className="modal-content">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
```

### 3. Optimistic Updates

```typescript
// src/store/optimistic.ts
const deleteItem = async (id: string) => {
  // Optimistic update - remove immediately
  set(state => {
    state.items = state.items.filter(item => item.id !== id);
    if (state.currentItem?.id === id) {
      state.currentItem = null;
    }
  });
  
  try {
    await api.deleteItem(id);
  } catch (error) {
    // Revert on error
    await get().fetchItems();
    throw error;
  }
};

const updateItem = async (id: string, updates: Partial<Item>) => {
  // Store original for rollback
  const original = get().items.find(i => i.id === id);
  
  // Optimistic update
  set(state => {
    const index = state.items.findIndex(i => i.id === id);
    if (index !== -1) {
      state.items[index] = { ...state.items[index], ...updates };
    }
  });
  
  try {
    await api.updateItem(id, updates);
  } catch (error) {
    // Rollback
    if (original) {
      set(state => {
        const index = state.items.findIndex(i => i.id === id);
        if (index !== -1) {
          state.items[index] = original;
        }
      });
    }
    throw error;
  }
};
```

### 4. P2P Node Selector

```typescript
// src/components/NodeSelector.tsx
export const NodeSelector: React.FC = () => {
  const { knownNodes, connectToNode } = useAppStore();
  const [selectedNode, setSelectedNode] = useState('');
  const [customNode, setCustomNode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  
  const handleConnect = async () => {
    const nodeToConnect = customNode || selectedNode;
    if (!nodeToConnect) return;
    
    setIsConnecting(true);
    try {
      await connectToNode(nodeToConnect);
      setCustomNode('');
    } catch (error) {
      alert(`Failed to connect: ${getErrorMessage(error)}`);
    } finally {
      setIsConnecting(false);
    }
  };
  
  return (
    <div className="node-selector">
      <h3>Connect to Node</h3>
      
      <div className="node-options">
        <label>
          <input
            type="radio"
            checked={!customNode}
            onChange={() => setCustomNode('')}
          />
          Known Nodes
        </label>
        <select
          value={selectedNode}
          onChange={e => setSelectedNode(e.target.value)}
          disabled={!!customNode || isConnecting}
        >
          <option value="">Select a node...</option>
          {knownNodes.map(node => (
            <option key={node} value={node}>{node}</option>
          ))}
        </select>
      </div>
      
      <div className="node-options">
        <label>
          <input
            type="radio"
            checked={!!customNode}
            onChange={() => setCustomNode('custom')}
          />
          Custom Node
        </label>
        <input
          type="text"
          placeholder="node-name.os"
          value={customNode}
          onChange={e => setCustomNode(e.target.value)}
          disabled={!customNode || isConnecting}
        />
      </div>
      
      <button 
        onClick={handleConnect}
        disabled={(!selectedNode && !customNode) || isConnecting}
      >
        {isConnecting ? 'Connecting...' : 'Connect'}
      </button>
    </div>
  );
};
```

## Styling Best Practices

### 1. CSS Organization

```css
/* src/styles/variables.css */
:root {
  /* Colors */
  --primary: #007bff;
  --primary-hover: #0056b3;
  --danger: #dc3545;
  --success: #28a745;
  --background: #f8f9fa;
  --surface: #ffffff;
  --text: #212529;
  --text-secondary: #6c757d;
  
  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  
  /* Borders */
  --border-radius: 0.25rem;
  --border-color: #dee2e6;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --background: #121212;
    --surface: #1e1e1e;
    --text: #ffffff;
    --text-secondary: #adb5bd;
    --border-color: #495057;
  }
}
```

### 2. Component Styles

```css
/* src/components/ItemList.module.css */
.container {
  display: grid;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
}

.item {
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  padding: var(--spacing-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.item:hover {
  border-color: var(--primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.item.selected {
  border-color: var(--primary);
  background: rgba(0, 123, 255, 0.05);
}

.emptyState {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--text-secondary);
}
```

## Performance Optimization

### 1. Memoization

```typescript
// src/components/ExpensiveList.tsx
import React, { useMemo, memo } from 'react';

interface ListItemProps {
  item: Item;
  onSelect: (id: string) => void;
}

// Memoize individual items
const ListItem = memo<ListItemProps>(({ item, onSelect }) => {
  return (
    <div onClick={() => onSelect(item.id)}>
      {item.name}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.name === nextProps.item.name
  );
});

export const ExpensiveList: React.FC = () => {
  const items = useItems();
  const { selectItem } = useAppStore();
  
  // Memoize filtered/sorted items
  const processedItems = useMemo(() => {
    return items
      .filter(item => item.active)
      .sort((a, b) => b.priority - a.priority);
  }, [items]);
  
  return (
    <div>
      {processedItems.map(item => (
        <ListItem 
          key={item.id} 
          item={item} 
          onSelect={selectItem}
        />
      ))}
    </div>
  );
};
```

### 2. Lazy Loading

```typescript
// src/App.tsx
import React, { Suspense, lazy } from 'react';

// Lazy load heavy components
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const Analytics = lazy(() => import('./components/Analytics'));

export const App: React.FC = () => {
  const { userRole } = useAppStore();
  
  return (
    <div className="app">
      <Header />
      <MainContent />
      
      <Suspense fallback={<LoadingSpinner />}>
        {userRole === 'admin' && <AdminPanel />}
        {showAnalytics && <Analytics />}
      </Suspense>
    </div>
  );
};
```

## Testing Patterns

### 1. Component Testing

```typescript
// src/components/__tests__/ItemList.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ItemList } from '../ItemList';
import { useAppStore } from '../../store/app';

// Mock the store
jest.mock('../../store/app');

describe('ItemList', () => {
  const mockItems = [
    { id: '1', name: 'Item 1', description: 'Desc 1' },
    { id: '2', name: 'Item 2', description: 'Desc 2' },
  ];
  
  beforeEach(() => {
    (useAppStore as jest.Mock).mockReturnValue({
      items: mockItems,
      isLoading: false,
      error: null,
      selectItem: jest.fn(),
    });
  });
  
  it('renders all items', () => {
    render(<ItemList />);
    
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });
  
  it('calls selectItem on click', () => {
    const selectItem = jest.fn();
    (useAppStore as jest.Mock).mockReturnValue({
      items: mockItems,
      selectItem,
    });
    
    render(<ItemList />);
    fireEvent.click(screen.getByText('Item 1'));
    
    expect(selectItem).toHaveBeenCalledWith('1');
  });
});
```

## Remember

1. **Always include `/our.js`** - It's mandatory
2. **Use tuple format** for multi-param API calls
3. **Handle loading states** - Users need feedback
4. **Design for offline** - Nodes can disconnect
5. **Test with real nodes** - localhost != production
6. **Optimize renders** - React DevTools Profiler helps
7. **Keep state minimal** - Don't store derived data
8. **Error boundaries** - Catch and handle errors gracefully