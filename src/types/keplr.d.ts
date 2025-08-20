// Global type declarations for Keplr wallet
import { OfflineSigner } from "@cosmjs/proto-signing";

interface ChainInfo {
  readonly chainId: string;
  readonly chainName: string;
  readonly rpc: string;
  readonly rest: string;
  readonly bip44: {
    readonly coinType: number;
  };
  readonly bech32Config: {
    readonly bech32PrefixAccAddr: string;
    readonly bech32PrefixAccPub: string;
    readonly bech32PrefixValAddr: string;
    readonly bech32PrefixValPub: string;
    readonly bech32PrefixConsAddr: string;
    readonly bech32PrefixConsPub: string;
  };
  readonly currencies: Array<{
    readonly coinDenom: string;
    readonly coinMinimalDenom: string;
    readonly coinDecimals: number;
    readonly coinGeckoId?: string;
  }>;
  readonly feeCurrencies: Array<{
    readonly coinDenom: string;
    readonly coinMinimalDenom: string;
    readonly coinDecimals: number;
    readonly coinGeckoId?: string;
    readonly gasPriceStep?: {
      readonly low: number;
      readonly average: number;
      readonly high: number;
    };
  }>;
  readonly stakeCurrency: {
    readonly coinDenom: string;
    readonly coinMinimalDenom: string;
    readonly coinDecimals: number;
    readonly coinGeckoId?: string;
  };
}

declare global {
  interface Window {
    keplr?: {
      enable: (chainId: string) => Promise<void>;
      getOfflineSigner: (chainId: string) => OfflineSigner;
      experimentalSuggestChain: (chainInfo: ChainInfo) => Promise<void>;
    };
  }
}

export {};
