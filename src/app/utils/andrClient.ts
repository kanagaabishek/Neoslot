// utils/andrClient.ts

export const getQueryClient = async (rpcUrl: string) => {
  try {
    // Dynamic import to avoid SSR issues
    const { CosmWasmClient } = await import("@cosmjs/cosmwasm-stargate");
    console.log("Connecting to RPC:", rpcUrl);
    const client = await CosmWasmClient.connect(rpcUrl);
    console.log("Query client connected successfully");
    return client;
  } catch (error) {
    console.error("Failed to connect query client:", error);
    throw new Error(`Failed to connect to RPC endpoint: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const getSigningClient = async (rpcUrl: string, wallet: any) => {
  try {
    // Dynamic import to avoid SSR issues
    const { SigningCosmWasmClient } = await import("@cosmjs/cosmwasm-stargate");
    const { GasPrice } = await import("@cosmjs/stargate");
    
    console.log("Setting up signing client with RPC:", rpcUrl);
    
    // Use a more conservative gas price for Andromeda
    const gasPrice = GasPrice.fromString("0.025uandr");
    
    const client = await SigningCosmWasmClient.connectWithSigner(
      rpcUrl,
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
    throw new Error(`Failed to connect to RPC endpoint: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Add a helper function to test RPC connectivity
export const testRpcConnectivity = async (rpcUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(`${rpcUrl}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add timeout
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (!response.ok) {
      console.error(`RPC status check failed: ${response.status} ${response.statusText}`);
      return false;
    }
    
    const data = await response.json();
    console.log("RPC status:", data);
    return true;
  } catch (error) {
    console.error("RPC connectivity test failed:", error);
    return false;
  }
};
