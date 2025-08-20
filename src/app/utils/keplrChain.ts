// Keplr chain configuration utilities

export const ANDROMEDA_CHAIN_CONFIG = {
  chainId: process.env.NEXT_PUBLIC_CHAIN_ID || "galileo-4",
  chainName: "Andromeda Testnet",
  rpc: process.env.NEXT_PUBLIC_RPC_URL || "http://137.184.182.11:26657",
  rest: process.env.NEXT_PUBLIC_CHAIN_REST || "http://137.184.182.11:1317",
  bip44: {
    coinType: 118,
  },
  bech32Config: {
    bech32PrefixAccAddr: "andr",
    bech32PrefixAccPub: "andr" + "pub",
    bech32PrefixValAddr: "andr" + "valoper",
    bech32PrefixValPub: "andr" + "valoperpub",
    bech32PrefixConsAddr: "andr" + "valcons",
    bech32PrefixConsPub: "andr" + "valconspub",
  },
  currencies: [
    {
      coinDenom: "ANDR",
      coinMinimalDenom: "uandr",
      coinDecimals: 6,
      coinGeckoId: "andromeda",
    },
  ],
  feeCurrencies: [
    {
      coinDenom: "ANDR",
      coinMinimalDenom: "uandr",
      coinDecimals: 6,
      coinGeckoId: "andromeda",
      gasPriceStep: {
        low: 0.025,
        average: 0.025,
        high: 0.04,
      },
    },
  ],
  stakeCurrency: {
    coinDenom: "ANDR",
    coinMinimalDenom: "uandr",
    coinDecimals: 6,
    coinGeckoId: "andromeda",
  },
};

export const setupKeplrChain = async () => {
  if (!window.keplr) {
    throw new Error("Keplr extension not found");
  }

  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID || "galileo-4";
  
  try {
    // Try to enable the chain first
    await window.keplr.enable(chainId);
  } catch (error) {
    // If chain is not recognized, suggest adding it
    try {
      await window.keplr.experimentalSuggestChain({
        ...ANDROMEDA_CHAIN_CONFIG,
        chainId,
        rpc: process.env.NEXT_PUBLIC_RPC_URL || ANDROMEDA_CHAIN_CONFIG.rpc,
        rest: process.env.NEXT_PUBLIC_CHAIN_REST || ANDROMEDA_CHAIN_CONFIG.rest,
      });
      
      // Now enable after suggesting
      await window.keplr.enable(chainId);
    } catch (suggestError) {
      console.error("Failed to suggest chain to Keplr:", suggestError);
      throw new Error("Failed to add Andromeda chain to Keplr. Please add it manually or check your Keplr extension.");
    }
  }

  return window.keplr.getOfflineSigner(chainId);
};
