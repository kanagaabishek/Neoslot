// utils/andrClient.ts

export const getQueryClient = async (rpcUrl: string) => {
  // Dynamic import to avoid SSR issues
  const { CosmWasmClient } = await import("@cosmjs/cosmwasm-stargate");
  return await CosmWasmClient.connect(rpcUrl);
};

export const getSigningClient = async (rpcUrl: string, wallet: any) => {
  // Dynamic import to avoid SSR issues
  const { SigningCosmWasmClient } = await import("@cosmjs/cosmwasm-stargate");
  return await SigningCosmWasmClient.connectWithSigner(
    rpcUrl,
    wallet
  );
};
