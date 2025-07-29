# 🧪 Testing & Debugging Guide

## Development Environment Setup

### 1. Local Node Testing
```bash
# Single node (default)
kit s

# Multiple local nodes for P2P testing
# Terminal 1
kit s --fake-node alice.os

# Terminal 2  
kit s --fake-node bob.os

# Terminal 3
kit s --fake-node charlie.os
```

### 2. Environment Variables
```bash
# Enable verbose logging
RUST_LOG=debug kit s

# Custom port (if default is taken)
kit s --port 8081
```

## Debugging Strategies

### 1. Backend Debugging (Rust)

#### Strategic println! Debugging
```rust
// Add context to all prints
impl AppState {
    fn debug_log(&self, context: &str, message: &str) {
        println!("[{}] {}: {}", 
            chrono::Utc::now().format("%H:%M:%S%.3f"),
            context,
            message
        );
    }
}

// Use in handlers
#[http]
async fn complex_operation(&mut self, request_body: String) -> Result<String, String> {
    self.debug_log("complex_operation", &format!("Request: {}", request_body));
    
    let parsed: MyRequest = serde_json::from_str(&request_body)
        .map_err(|e| {
            self.debug_log("complex_operation", &format!("Parse error: {}", e));
            format!("Invalid request: {}", e)
        })?;
    
    self.debug_log("complex_operation", &format!("Parsed: {:?}", parsed));
    
    // Operation logic...
    
    self.debug_log("complex_operation", "Operation completed successfully");
    Ok("Success".to_string())
}
```

#### State Inspection
```rust
// Add debug endpoint to inspect state
#[http]
async fn debug_state(&self, _request_body: String) -> String {
    // Only in development!
    if cfg!(debug_assertions) {
        serde_json::json!({
            "node": our().node,
            "item_count": self.items.len(),
            "connected_nodes": self.connected_nodes,
            "last_sync": self.last_sync_time,
            "pending_operations": self.pending_operations.len(),
            // Don't expose sensitive data
        }).to_string()
    } else {
        "Debug disabled in production".to_string()
    }
}

// Pretty print for complex debugging
#[http]
async fn debug_item(&self, request_body: String) -> String {
    let id: String = serde_json::from_str(&request_body).unwrap_or_default();
    
    if let Some(item) = self.items.iter().find(|i| i.id == id) {
        // Pretty print with indentation
        serde_json::to_string_pretty(item).unwrap()
    } else {
        "Not found".to_string()
    }
}
```

#### P2P Communication Debugging
```rust
// Wrap remote calls with debugging
async fn debug_remote_call(
    &self,
    target: Address,
    method: &str,
    data: String,
) -> Result<String, String> {
    println!("\n=== P2P DEBUG START ===");
    println!("Target: {:?}", target);
    println!("Method: {}", method);
    println!("Request: {}", data);
    
    let start = std::time::Instant::now();
    let wrapper = json!({ method: data });
    
    let result = Request::new()
        .target(target)
        .body(serde_json::to_vec(&wrapper).unwrap())
        .expects_response(30)
        .send_and_await_response(30);
    
    let duration = start.elapsed();
    
    match &result {
        Ok(response) => {
            if let Ok(body) = response.body() {
                let body_str = String::from_utf8_lossy(&body);
                println!("Response ({}ms): {}", duration.as_millis(), body_str);
            }
        }
        Err(e) => {
            println!("Error ({}ms): {:?}", duration.as_millis(), e);
        }
    }
    
    println!("=== P2P DEBUG END ===\n");
    
    result.map(|r| String::from_utf8_lossy(&r.body().unwrap_or_default()).to_string())
        .map_err(|e| format!("{:?}", e))
}
```

### 2. Frontend Debugging (React/TypeScript)

#### API Call Debugging
```typescript
// src/utils/debug.ts
const DEBUG = import.meta.env.DEV;

export function debugLog(category: string, ...args: any[]) {
  if (DEBUG) {
    console.log(`[${new Date().toISOString()}] [${category}]`, ...args);
  }
}

// Enhanced API wrapper with debugging
export async function debugApiCall<T>(
  method: string,
  data: any,
  description: string
): Promise<T> {
  const requestId = Math.random().toString(36).substr(2, 9);
  
  debugLog('API', `[${requestId}] Starting: ${description}`);
  debugLog('API', `[${requestId}] Method: ${method}`);
  debugLog('API', `[${requestId}] Data:`, data);
  
  const startTime = performance.now();
  
  try {
    const result = await makeApiCall<any, T>(method, data);
    const duration = performance.now() - startTime;
    
    debugLog('API', `[${requestId}] Success (${duration.toFixed(2)}ms):`, result);
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    debugLog('API', `[${requestId}] Error (${duration.toFixed(2)}ms):`, error);
    throw error;
  }
}
```

#### State Debugging with Zustand
```typescript
// src/store/debug.ts
import { useAppStore } from './app';

// Debug middleware
export const debugMiddleware = (config: any) => (set: any, get: any, api: any) =>
  config(
    (args: any) => {
      console.log('  [State Change]', args);
      set(args);
    },
    get,
    api
  );

// Usage in store
export const useAppStore = create<AppState>()(
  devtools(
    debugMiddleware((set, get) => ({
      // Your store implementation
    })),
    {
      name: 'app-store',
    }
  )
);

// Debug component
export const StoreDebugger: React.FC = () => {
  const store = useAppStore();
  
  if (!import.meta.env.DEV) return null;
  
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      right: 0,
      background: 'black',
      color: 'white',
      padding: '10px',
      maxWidth: '300px',
      maxHeight: '200px',
      overflow: 'auto',
      fontSize: '12px',
      fontFamily: 'monospace',
    }}>
      <h4>Store State</h4>
      <pre>{JSON.stringify(store, null, 2)}</pre>
    </div>
  );
};
```

#### React DevTools Integration
```typescript
// Name components for better debugging
export const ItemList = React.memo(
  function ItemList({ items }: { items: Item[] }) {
    // Component logic
  }
);

// Add display names to hooks
export function useItems() {
  // Hook logic
}
useItems.displayName = 'useItems';
```

### 3. Network Debugging

#### Monitor All HTTP Traffic
```typescript
// src/utils/network-debug.ts
if (import.meta.env.DEV) {
  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const [url, options] = args;
    console.group(`🌐 Fetch: ${options?.method || 'GET'} ${url}`);
    console.log('Request:', options);
    
    try {
      const response = await originalFetch(...args);
      const clone = response.clone();
      const data = await clone.json().catch(() => 'Non-JSON response');
      
      console.log('Response:', {
        status: response.status,
        statusText: response.statusText,
        data,
      });
      console.groupEnd();
      
      return response;
    } catch (error) {
      console.error('Error:', error);
      console.groupEnd();
      throw error;
    }
  };
}
```

## Testing Patterns

### 1. Unit Testing (Rust)

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    fn create_test_state() -> AppState {
        AppState {
            items: vec![
                Item { id: "1".to_string(), name: "Test 1".to_string() },
                Item { id: "2".to_string(), name: "Test 2".to_string() },
            ],
            ..Default::default()
        }
    }
    
    #[test]
    fn test_item_creation() {
        let mut state = create_test_state();
        let initial_count = state.items.len();
        
        // Simulate item creation
        state.items.push(Item {
            id: "3".to_string(),
            name: "Test 3".to_string(),
        });
        
        assert_eq!(state.items.len(), initial_count + 1);
        assert_eq!(state.items.last().unwrap().name, "Test 3");
    }
    
    #[test]
    fn test_item_deletion() {
        let mut state = create_test_state();
        state.items.retain(|item| item.id != "1");
        
        assert_eq!(state.items.len(), 1);
        assert!(!state.items.iter().any(|i| i.id == "1"));
    }
    
    #[tokio::test]
    async fn test_async_operation() {
        let mut state = create_test_state();
        
        // Test async method
        let result = state.process_items().await;
        assert!(result.is_ok());
    }
}
```

### 2. Integration Testing

```typescript
// src/__tests__/integration.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAppStore } from '../store/app';
import * as api from '../utils/api';

// Mock API
jest.mock('../utils/api');

describe('App Integration', () => {
  beforeEach(() => {
    // Reset store
    useAppStore.setState({
      items: [],
      isLoading: false,
      error: null,
    });
  });
  
  it('fetches and displays items', async () => {
    const mockItems = [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
    ];
    
    (api.getItems as jest.Mock).mockResolvedValue(mockItems);
    
    const { result } = renderHook(() => useAppStore());
    
    // Trigger fetch
    await act(async () => {
      await result.current.fetchItems();
    });
    
    await waitFor(() => {
      expect(result.current.items).toEqual(mockItems);
      expect(result.current.isLoading).toBe(false);
    });
  });
  
  it('handles errors gracefully', async () => {
    const error = new Error('Network error');
    (api.getItems as jest.Mock).mockRejectedValue(error);
    
    const { result } = renderHook(() => useAppStore());
    
    await act(async () => {
      await result.current.fetchItems();
    });
    
    expect(result.current.error).toBe('Network error');
    expect(result.current.items).toEqual([]);
  });
});
```

### 3. P2P Testing Scenarios

```bash
# test-p2p.sh
#!/bin/bash

echo "Starting P2P test environment..."

# Start nodes
kit s --fake-node alice.os &
ALICE_PID=$!

sleep 2

kit s --fake-node bob.os --port 8081 &
BOB_PID=$!

sleep 2

echo "Nodes started: Alice (PID: $ALICE_PID), Bob (PID: $BOB_PID)"
echo "Access Alice at http://localhost:8080"
echo "Access Bob at http://localhost:8081"

# Wait for user to finish testing
read -p "Press Enter to stop nodes..."

# Cleanup
kill $ALICE_PID $BOB_PID
echo "Test environment stopped"
```

#### P2P Test Checklist
```typescript
// src/tests/p2p-checklist.ts
export const P2P_TEST_SCENARIOS = [
  {
    name: "Basic Connectivity",
    steps: [
      "Start two nodes (alice.os and bob.os)",
      "From Alice, try to connect to Bob",
      "Verify connection status on both nodes",
      "Check console logs for any errors",
    ],
  },
  {
    name: "Data Synchronization",
    steps: [
      "Create data on Alice node",
      "Trigger sync from Bob node",
      "Verify data appears on Bob",
      "Modify data on Bob",
      "Sync back to Alice",
      "Verify both nodes have same data",
    ],
  },
  {
    name: "Network Resilience",
    steps: [
      "Establish connection between nodes",
      "Stop Bob node (Ctrl+C)",
      "Try operation from Alice",
      "Verify graceful error handling",
      "Restart Bob node",
      "Verify automatic reconnection",
    ],
  },
  {
    name: "Concurrent Updates",
    steps: [
      "Open same item on both nodes",
      "Make different changes simultaneously",
      "Save on both nodes",
      "Verify conflict resolution",
      "Check final state consistency",
    ],
  },
];
```

## Performance Profiling

### 1. Backend Performance
```rust
// Simple timing macro
macro_rules! time_operation {
    ($name:expr, $body:expr) => {{
        let start = std::time::Instant::now();
        let result = $body;
        let duration = start.elapsed();
        println!("[PERF] {} took {:?}", $name, duration);
        result
    }};
}

// Usage
#[http]
async fn heavy_operation(&mut self, request_body: String) -> Result<String, String> {
    let parsed = time_operation!("parsing", {
        serde_json::from_str::<ComplexRequest>(&request_body)?
    });
    
    let result = time_operation!("processing", {
        self.process_complex_request(parsed)?
    });
    
    time_operation!("serializing", {
        Ok(serde_json::to_string(&result).unwrap())
    })
}
```

### 2. Frontend Performance
```typescript
// src/utils/performance.ts
export class PerformanceMonitor {
  private marks: Map<string, number> = new Map();
  
  start(label: string) {
    this.marks.set(label, performance.now());
  }
  
  end(label: string, threshold = 100) {
    const start = this.marks.get(label);
    if (!start) return;
    
    const duration = performance.now() - start;
    this.marks.delete(label);
    
    if (duration > threshold) {
      console.warn(`⚠️ Slow operation: ${label} took ${duration.toFixed(2)}ms`);
    } else if (import.meta.env.DEV) {
      console.log(`✅ ${label}: ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  }
}

export const perfMon = new PerformanceMonitor();

// Usage
const fetchData = async () => {
  perfMon.start('fetchData');
  try {
    const data = await api.getData();
    return data;
  } finally {
    perfMon.end('fetchData');
  }
};
```

## Common Debugging Scenarios

### 1. "Why isn't my endpoint being called?"
```typescript
// Debug checklist component
export const EndpointDebugger: React.FC = () => {
  const [results, setResults] = useState<any[]>([]);
  
  const runDiagnostics = async () => {
    const diagnostics = [];
    
    // Check 1: Node connection
    diagnostics.push({
      test: 'Node Connection',
      result: window.our ? `✅ Connected as ${window.our.node}` : '❌ No connection',
    });
    
    // Check 2: API endpoint
    try {
      const response = await fetch('/api');
      diagnostics.push({
        test: 'API Endpoint',
        result: `✅ Status ${response.status}`,
      });
    } catch (error) {
      diagnostics.push({
        test: 'API Endpoint',
        result: `❌ Error: ${error}`,
      });
    }
    
    // Check 3: Method call
    try {
      await api.getStatus();
      diagnostics.push({
        test: 'GetStatus Method',
        result: '✅ Success',
      });
    } catch (error) {
      diagnostics.push({
        test: 'GetStatus Method',
        result: `❌ Error: ${error}`,
      });
    }
    
    setResults(diagnostics);
  };
  
  return (
    <div className="debugger">
      <button onClick={runDiagnostics}>Run Diagnostics</button>
      <ul>
        {results.map((r, i) => (
          <li key={i}>{r.test}: {r.result}</li>
        ))}
      </ul>
    </div>
  );
};
```

### 2. "Why is my P2P call failing?"
```rust
// Diagnostic endpoint
#[http]
async fn diagnose_p2p(&self, request_body: String) -> String {
    let target_node: String = serde_json::from_str(&request_body).unwrap_or_default();
    let mut diagnostics = vec![];
    
    // Check 1: ProcessId parsing
    match "skeleton-app:skeleton-app:skeleton.os".parse::<ProcessId>() {
        Ok(pid) => diagnostics.push(format!("✅ ProcessId valid: {:?}", pid)),
        Err(e) => diagnostics.push(format!("❌ ProcessId error: {}", e)),
    }
    
    // Check 2: Address construction
    if !target_node.is_empty() {
        let pid = "skeleton-app:skeleton-app:skeleton.os".parse::<ProcessId>().ok();
        if let Some(pid) = pid {
            let addr = Address::new(target_node.clone(), pid);
            diagnostics.push(format!("✅ Address created: {:?}", addr));
            
            // Check 3: Ping attempt
            let ping = json!({ "Ping": "" });
            match Request::new()
                .target(addr)
                .body(serde_json::to_vec(&ping).unwrap())
                .expects_response(5)
                .send_and_await_response(5) {
                    Ok(_) => diagnostics.push("✅ Node reachable".to_string()),
                    Err(e) => diagnostics.push(format!("❌ Node unreachable: {:?}", e)),
                }
        }
    }
    
    serde_json::to_string(&diagnostics).unwrap()
}
```

## Production Debugging

### 1. Conditional Logging
```rust
// Only in debug builds
#[cfg(debug_assertions)]
fn debug_log(&self, msg: &str) {
    println!("[DEBUG] {}", msg);
}

#[cfg(not(debug_assertions))]
fn debug_log(&self, _msg: &str) {
    // No-op in release
}
```

### 2. Error Reporting
```typescript
// Structured error reporting
export function reportError(error: Error, context: Record<string, any>) {
  const report = {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
    node: window.our?.node || 'unknown',
    userAgent: navigator.userAgent,
  };
  
  // In production, send to logging service
  if (import.meta.env.PROD) {
    // Send to your logging endpoint
    api.logError(report).catch(console.error);
  } else {
    console.error('Error Report:', report);
  }
}
```

## Remember

1. **Always test P2P early** - Single node testing hides issues
2. **Log strategically** - Too much noise makes debugging harder
3. **Use proper error types** - Generic errors hide problems
4. **Test edge cases** - Network failures, concurrent updates
5. **Monitor performance** - Catch slowdowns before users do
6. **Document issues** - Future you will thank you
7. **Clean up debug code** - Don't ship console.logs to production