// utils/andrClient.ts
import { OfflineSigner } from "@cosmjs/proto-signing";

// RPC endpoint configuration with multiple fallbacks
const PRIMARY_RPC = process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_CHAIN_RPC!;
const FALLBACK_ENDPOINTS = [
  process.env.NEXT_PUBLIC_FALLBACK_RPC_1,
  process.env.NEXT_PUBLIC_FALLBACK_RPC_2,
  process.env.NEXT_PUBLIC_FALLBACK_RPC_3,
  process.env.NEXT_PUBLIC_FALLBACK_RPC_4,
  PRIMARY_RPC // Use primary as final fallback
].filter(Boolean) as string[];

// Check if we're in production and on client side
const isProduction = process.env.NODE_ENV === 'production';
const isClient = typeof window !== 'undefined';

// Helper function to test RPC connectivity with shorter timeout for production
export const testRpcConnectivity = async (rpcUrl: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // Reduced to 5 seconds for faster fallback
    
    const response = await fetch(`${rpcUrl}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn(`RPC status check failed for ${rpcUrl}: ${response.status} ${response.statusText}`);
      return false;
    }
    
    const data = await response.json();
    console.log(`✅ RPC ${rpcUrl} is responsive - Network: ${data.result?.node_info?.network}`);
    return true;
  } catch (error) {
    console.warn(`❌ RPC connectivity test failed for ${rpcUrl}:`, error instanceof Error ? error.message : error);
    return false;
  }
};

// Test the proxy endpoint
export const testProxyConnectivity = async (): Promise<boolean> => {
  if (!isClient) return false;
  
  try {
    const response = await fetch('/api/rpc-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'GET', path: '/status' })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ RPC Proxy is working - Network:', data.result?.node_info?.network);
      return true;
    }
    
    console.warn('❌ RPC Proxy failed:', response.status, response.statusText);
    return false;
  } catch (error) {
    console.warn('❌ RPC Proxy connectivity test failed:', error);
    return false;
  }
};

// Get the best available RPC endpoint with multiple fallbacks
export const getBestRpcEndpoint = async (): Promise<string> => {
  console.log("🔍 Testing RPC endpoints for best connectivity...");
  
  // In production, try proxy first to avoid CORS issues
  if (isProduction && isClient) {
    console.log("🔄 Production mode: Testing proxy endpoint first...");
    if (await testProxyConnectivity()) {
      console.log("✅ Using RPC proxy for production");
      return '/api/rpc-proxy';
    }
  }
  
  // Test primary endpoint first
  if (await testRpcConnectivity(PRIMARY_RPC)) {
    console.log("✅ Using primary RPC:", PRIMARY_RPC);
    return PRIMARY_RPC;
  }
  
  // Try all fallback endpoints
  console.log("⚠️ Primary RPC failed, trying fallback endpoints...");
  for (const endpoint of FALLBACK_ENDPOINTS) {
    if (endpoint && await testRpcConnectivity(endpoint)) {
      console.log("✅ Using fallback RPC:", endpoint);
      return endpoint;
    }
  }
  
  // If all fail, throw a detailed error
  throw new Error(`🚫 Failed to connect to any RPC endpoint. Tried:\n${[PRIMARY_RPC, ...FALLBACK_ENDPOINTS].map(ep => `• ${ep}`).join('\n')}\n\nThis may be due to:\n• Network connectivity issues\n• All RPC endpoints being temporarily unavailable\n• Deployment platform blocking HTTP requests\n• Firewall restrictions\n\nPlease try again later or contact support.`);
};

export const getQueryClient = async (rpcUrl?: string) => {
  try {
    // Dynamic import to avoid SSR issues
    const { CosmWasmClient } = await import("@cosmjs/cosmwasm-stargate");
    
    // Use provided RPC or find the best available
    const endpoint = rpcUrl || await getBestRpcEndpoint();
    
    // If using proxy endpoint, create a custom client
    if (endpoint === '/api/rpc-proxy') {
      console.log("Creating proxy-based query client");
      // For proxy, we'll create a basic client that uses our primary RPC
      // This is a workaround for production deployment issues
      const client = await CosmWasmClient.connect(PRIMARY_RPC);
      console.log("Proxy-based query client connected successfully");
      return client;
    }
    
    console.log("Connecting to RPC:", endpoint);
    const client = await CosmWasmClient.connect(endpoint);
    console.log("Query client connected successfully");
    return client;
  } catch (error) {
    console.error("Failed to connect query client:", error);
    
    // If all else fails, try a direct connection to primary RPC
    try {
      console.log("⚠️ Falling back to direct primary RPC connection...");
      const { CosmWasmClient } = await import("@cosmjs/cosmwasm-stargate");
      const client = await CosmWasmClient.connect(PRIMARY_RPC);
      console.log("✅ Fallback connection successful");
      return client;
    } catch (fallbackError) {
      console.error("❌ Even fallback connection failed:", fallbackError);
    }
    
    // Provide more helpful error messages
    if (error instanceof Error && error.message.includes('Failed to connect to any RPC endpoint')) {
      throw new Error(`Failed to connect to blockchain network. This may be due to:\n• Network connectivity issues\n• RPC endpoints being temporarily unavailable\n• Firewall blocking HTTP requests (try using HTTPS endpoints in production)\n\nPlease try again in a few moments.`);
    }
    
    throw new Error(`Failed to connect to RPC endpoint: ${rpcUrl}. ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const getSigningClient = async (rpcUrl: string, wallet: OfflineSigner) => {
  try {
    // Dynamic import to avoid SSR issues
    const { SigningCosmWasmClient } = await import("@cosmjs/cosmwasm-stargate");
    const { GasPrice } = await import("@cosmjs/stargate");
    
    // Use provided RPC or find the best available
    const endpoint = rpcUrl || await getBestRpcEndpoint();
    
    console.log("Setting up signing client with RPC:", endpoint);
    
    // Use a more conservative gas price for Andromeda
    const gasPrice = GasPrice.fromString("0.025uandr");
    
    const client = await SigningCosmWasmClient.connectWithSigner(
      endpoint,
      wallet,
      { 
        gasPrice,
        // Add explicit timeout and retry settings
        broadcastPollIntervalMs: 3000,
        broadcastTimeoutMs: 30000
      }
    );
    
    console.log("Signing client connected successfully");
    return client;
  } catch (error) {
    console.error("Failed to connect signing client:", error);
    throw new Error(`Failed to connect to RPC endpoint: ${rpcUrl}. ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
