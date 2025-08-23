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
  console.log('🔧 Setting up Keplr chain...');
  
  if (!window.keplr) {
    console.error('❌ Keplr extension not found in setupKeplrChain');
    throw new Error("Keplr extension not found");
  }

  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID || "galileo-4";
  console.log('🌐 Chain ID:', chainId);
  
  try {
    // Try to enable the chain first
    console.log('🔄 Attempting to enable chain...');
    await window.keplr.enable(chainId);
    console.log('✅ Chain enabled successfully');
  } catch (error) {
    console.warn('⚠️ Chain not recognized, suggesting chain to Keplr...');
    // If chain is not recognized, suggest adding it
    try {
      const chainConfig = {
        ...ANDROMEDA_CHAIN_CONFIG,
        chainId,
        rpc: process.env.NEXT_PUBLIC_RPC_URL || ANDROMEDA_CHAIN_CONFIG.rpc,
        rest: process.env.NEXT_PUBLIC_CHAIN_REST || ANDROMEDA_CHAIN_CONFIG.rest,
      };
      
      console.log('📤 Suggesting chain config:', chainConfig);
      await window.keplr.experimentalSuggestChain(chainConfig);
      console.log('✅ Chain suggested successfully');
      
      // Now enable after suggesting
      console.log('🔄 Enabling chain after suggestion...');
      await window.keplr.enable(chainId);
      console.log('✅ Chain enabled after suggestion');
    } catch (suggestError) {
      console.error("❌ Failed to suggest chain to Keplr:", suggestError);
      throw new Error("Failed to add Andromeda chain to Keplr. Please add it manually or check your Keplr extension.");
    }
  }

  console.log('🔄 Getting offline signer...');
  const signer = window.keplr.getOfflineSigner(chainId);
  console.log('✅ Offline signer obtained');
  
  return signer;
};
