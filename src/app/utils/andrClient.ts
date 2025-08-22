// utils/andrClient.ts
import { OfflineSigner } from "@cosmjs/proto-signing";

// RPC endpoint configuration
const PRIMARY_RPC = process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_CHAIN_RPC!;
const FALLBACK_RPC = process.env.NEXT_PUBLIC_FALLBACK_RPC || PRIMARY_RPC;

// Helper function to test RPC connectivity
export const testRpcConnectivity = async (rpcUrl: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`${rpcUrl}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`RPC status check failed: ${response.status} ${response.statusText}`);
      return false;
    }
    
    const data = await response.json();
    console.log(`RPC ${rpcUrl} is responsive:`, data.result?.node_info?.network);
    return true;
  } catch (error) {
    console.error(`RPC connectivity test failed for ${rpcUrl}:`, error);
    return false;
  }
};

// Get the best available RPC endpoint
export const getBestRpcEndpoint = async (): Promise<string> => {
  console.log("Testing RPC endpoints...");
  
  // Test primary endpoint first
  if (await testRpcConnectivity(PRIMARY_RPC)) {
    console.log("Using primary RPC:", PRIMARY_RPC);
    return PRIMARY_RPC;
  }
  
  // Fallback to secondary endpoint
  console.log("Primary RPC failed, trying fallback...");
  if (await testRpcConnectivity(FALLBACK_RPC)) {
    console.log("Using fallback RPC:", FALLBACK_RPC);
    return FALLBACK_RPC;
  }
  
  // If both fail, throw an error
  throw new Error(`Failed to connect to any RPC endpoint. Tried: ${PRIMARY_RPC}, ${FALLBACK_RPC}`);
};

export const getQueryClient = async (rpcUrl?: string) => {
  try {
    // Dynamic import to avoid SSR issues
    const { CosmWasmClient } = await import("@cosmjs/cosmwasm-stargate");
    
    // Use provided RPC or find the best available
    const endpoint = rpcUrl || await getBestRpcEndpoint();
    
    console.log("Connecting to RPC:", endpoint);
    const client = await CosmWasmClient.connect(endpoint);
    console.log("Query client connected successfully");
    return client;
  } catch (error) {
    console.error("Failed to connect query client:", error);
    
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
