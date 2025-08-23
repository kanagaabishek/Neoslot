// utils/andrClient.ts
import { OfflineSigner } from "@cosmjs/proto-signing";

// Default RPC endpoint (working endpoint)
const DEFAULT_RPC = "http://137.184.182.11:26657";

// RPC endpoint configuration with multiple fallbacks
const PRIMARY_RPC = process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_CHAIN_RPC || DEFAULT_RPC;
const FALLBACK_ENDPOINTS = [
  process.env.NEXT_PUBLIC_FALLBACK_RPC_1 || "https://rpc.testnet.andromedaprotocol.io",
  process.env.NEXT_PUBLIC_FALLBACK_RPC_2 || DEFAULT_RPC,
  process.env.NEXT_PUBLIC_FALLBACK_RPC_3 || DEFAULT_RPC,
  process.env.NEXT_PUBLIC_FALLBACK_RPC_4 || DEFAULT_RPC,
].filter(Boolean) as string[];

// Check if we're in client context
const isClient = typeof window !== 'undefined';

// Get production-safe RPC endpoint
export const getProductionSafeRPC = (): string => {
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    // In HTTPS context, prioritize HTTPS RPC endpoints
    const httpsEndpoints = [PRIMARY_RPC, ...FALLBACK_ENDPOINTS].filter(url => url.startsWith('https:'));
    if (httpsEndpoints.length > 0) {
      console.log('Using HTTPS RPC for production:', httpsEndpoints[0]);
      return httpsEndpoints[0];
    }
    // If no HTTPS endpoints available, use proxy or fallback to HTTP
    console.warn('No HTTPS RPC endpoints available, may cause mixed content issues in production');
  }
  console.log('Using primary RPC:', PRIMARY_RPC);
  return PRIMARY_RPC;
};

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
  
  // Use production-safe RPC first
  const primaryEndpoint = getProductionSafeRPC();
  
  // Test primary endpoint first
  if (await testRpcConnectivity(primaryEndpoint)) {
    console.log("✅ Using production-safe RPC:", primaryEndpoint);
    return primaryEndpoint;
  }
  
  // Try all endpoints, prioritizing HTTPS in production
  console.log("⚠️ Primary RPC failed, trying fallback endpoints...");
  const allEndpoints = [PRIMARY_RPC, ...FALLBACK_ENDPOINTS];
  
  // In HTTPS context, try HTTPS endpoints first
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    const httpsEndpoints = allEndpoints.filter(url => url.startsWith('https:'));
    for (const endpoint of httpsEndpoints) {
      if (endpoint && await testRpcConnectivity(endpoint)) {
        console.log("✅ Using HTTPS fallback RPC:", endpoint);
        return endpoint;
      }
    }
  }
  
  // Try remaining endpoints
  for (const endpoint of allEndpoints) {
    if (endpoint && await testRpcConnectivity(endpoint)) {
      console.log("✅ Using fallback RPC:", endpoint);
      return endpoint;
    }
  }
  
  // If all fail, return primary as last resort
  console.log("⚠️ All endpoints failed, using primary as last resort");
  return primaryEndpoint;
};

export const getQueryClient = async (rpcUrl?: string) => {
  let finalEndpoint = DEFAULT_RPC; // Default fallback
  
  try {
    // Dynamic import to avoid SSR issues
    const { CosmWasmClient } = await import("@cosmjs/cosmwasm-stargate");
    
    // Use provided RPC or try to find the best available
    if (rpcUrl) {
      finalEndpoint = rpcUrl;
    } else {
      try {
        finalEndpoint = await getBestRpcEndpoint();
      } catch (endpointError) {
        console.warn("Could not find best endpoint, using default:", DEFAULT_RPC);
        finalEndpoint = DEFAULT_RPC;
      }
    }
    
    console.log("Connecting to RPC:", finalEndpoint);
    const client = await CosmWasmClient.connect(finalEndpoint);
    console.log("✅ Query client connected successfully");
    return client;
    
  } catch (error) {
    console.error("Failed to connect query client:", error);
    
    // If all else fails, try a direct connection to default RPC
    try {
      console.log("⚠️ Falling back to default RPC connection:", DEFAULT_RPC);
      const { CosmWasmClient } = await import("@cosmjs/cosmwasm-stargate");
      const client = await CosmWasmClient.connect(DEFAULT_RPC);
      console.log("✅ Fallback connection successful");
      return client;
    } catch (fallbackError) {
      console.error("❌ Even fallback connection failed:", fallbackError);
      throw new Error(`Failed to connect to blockchain network. Tried endpoints: ${finalEndpoint}, ${DEFAULT_RPC}. This may be due to network connectivity issues or RPC endpoints being unavailable.`);
    }
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
    const finalEndpoint = rpcUrl || DEFAULT_RPC;
    throw new Error(`Failed to connect to RPC endpoint: ${finalEndpoint}. ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
