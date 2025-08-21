'use client'
import { useEffect, useState } from "react";
import Link from "next/link";
import { getQueryClient, getSigningClient } from "./utils/andrClient";
import { setupKeplrChain } from "./utils/keplrChain";
import NFTCard from "./components/NFTcard";
import WalletPrompt from "./components/WalletPrompt";
import { useWallet } from "./hooks/useWallet";

const cw721 = process.env.NEXT_PUBLIC_CW721_ADDRESS!;
const marketplace = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS!;

interface NFTSale {
  saleId: string;
  tokenId: string;
  price: string;
  seller: string;
  status: string;
  coinDenom: string;
  isSold: boolean;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    start_time?: string;
    meeting_link?: string;
    event_type?: string;
  };
}

export default function Home() {
  const { address, isConnected } = useWallet();
  const [nfts, setNFTs] = useState<NFTSale[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Check if environment variables are set
  useEffect(() => {
    if (!cw721 || !marketplace) {
      setError("Missing environment variables. Please check your .env.local file.");
    }
  }, []);

  // Debug environment variables
  useEffect(() => {
    console.log('🔧 Environment variables check:');
    console.log('NEXT_PUBLIC_RPC_URL:', process.env.NEXT_PUBLIC_RPC_URL);
    console.log('NEXT_PUBLIC_CHAIN_RPC:', process.env.NEXT_PUBLIC_CHAIN_RPC);
    console.log('NEXT_PUBLIC_CHAIN_ID:', process.env.NEXT_PUBLIC_CHAIN_ID);
    console.log('NEXT_PUBLIC_CW721_ADDRESS:', process.env.NEXT_PUBLIC_CW721_ADDRESS);
    console.log('NEXT_PUBLIC_MARKETPLACE_ADDRESS:', process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS);
  }, []);

  const fetchNFTs = async () => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    let rpc = '';
    try {
      setLoading(true);
      setError("");
      
      rpc = process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_CHAIN_RPC!;
      
      if (!rpc) {
        throw new Error('No RPC URL configured. Please check your environment variables.');
      }
      
      console.log(`Connecting to RPC: ${rpc}`);
      
      let client;
      try {
        client = await getQueryClient(rpc);
        if (!client) {
          throw new Error('Failed to create query client');
        }
        console.log('Successfully connected to RPC');
      } catch (rpcError) {
        console.error('RPC connection failed:', rpcError);
        throw new Error(`Failed to connect to RPC endpoint: ${rpc}. Please check your network connection.`);
      }

      // Get all sales for our CW721 contract using sale_infos_for_address
      console.log('Querying marketplace for sales...');
      
      let saleInfosResponse;
      try {
        saleInfosResponse = await Promise.race([
          client.queryContractSmart(marketplace, {
            sale_infos_for_address: { 
              token_address: cw721,
              start_after: null,
              limit: 50 // Get up to 50 sales
            }
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Marketplace query timeout')), 15000)
          )
        ]);
      } catch (marketplaceError) {
        console.error('Marketplace query failed:', marketplaceError);
        throw new Error('Failed to fetch marketplace data. The marketplace contract may be unavailable.');
      }
      
      console.log('Sale infos response:', saleInfosResponse);
      
      if (!saleInfosResponse || saleInfosResponse.length === 0) {
        console.log('No sales found');
        setNFTs([]);
        return;
      }

      // Fetch detailed sale state for each sale
      const salesPromises = saleInfosResponse.flatMap((info: Record<string, unknown>) => 
        (info.sale_ids as string[]).map(async (saleId: string) => {
          try {
            console.log(`Fetching sale state for sale ID: ${saleId}`);
            
            // Add timeout and retry logic
            let saleState;
            try {
              saleState = await Promise.race([
                client.queryContractSmart(marketplace, {
                  sale_state: { sale_id: saleId }
                }),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Timeout')), 10000)
                )
              ]);
              console.log(`Sale state for ${saleId}:`, saleState);
            } catch (saleStateError) {
              console.error(`Failed to fetch sale state for ${saleId}:`, saleStateError);
              throw saleStateError;
            }
            
            // Fetch NFT metadata from CW721 contract
            let metadata = null;
            try {
              console.log(`Fetching NFT info for token: ${info.token_id}`);
              const nftInfo = await Promise.race([
                client.queryContractSmart(cw721, {
                  nft_info: { token_id: info.token_id }
                }),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('NFT info timeout')), 8000)
                )
              ]);
              
              // Parse metadata from token_uri or extension (same as NFT details page)
              let parsedMetadata: Record<string, unknown> = {};
              
              if (nftInfo.token_uri) {
                try {
                  parsedMetadata = JSON.parse(nftInfo.token_uri);
                } catch {
                  // If parsing fails, treat as plain string
                  parsedMetadata = { name: nftInfo.token_uri };
                }
              }
              
              if (nftInfo.extension) {
                parsedMetadata = { ...parsedMetadata, ...nftInfo.extension };
              }
              
              metadata = parsedMetadata;
              console.log(`Metadata for token ${info.token_id}:`, metadata);
            } catch (metadataError) {
              console.warn(`Could not fetch metadata for token ${info.token_id}:`, metadataError);
            }
            
            return {
              saleId,
              tokenId: info.token_id as string,
              price: saleState.price,
              status: saleState.status,
              seller: saleState.recipient?.address,
              coinDenom: saleState.coin_denom,
              isSold: saleState.status === 'executed',
              metadata: metadata as NFTSale['metadata']
            };
          } catch (error) {
            console.error(`Error fetching sale ${saleId}:`, {
              error: error instanceof Error ? error.message : String(error),
              saleId,
              tokenId: info.token_id
            });
            // Return null so we can filter it out, but don't crash the entire fetch
            return null;
          }
        })
      );

      console.log(`Processing ${salesPromises.length} sales...`);
      
      // Use Promise.allSettled to handle individual failures gracefully
      const salesResults = await Promise.allSettled(salesPromises);
      const validSales = salesResults
        .filter((result): result is PromiseFulfilledResult<NFTSale | null> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value);
      
      console.log(`Successfully loaded ${validSales.length} out of ${salesPromises.length} sales`);
      setNFTs(validSales);

      // Show a warning if some sales failed to load
      if (validSales.length < salesPromises.length) {
        const failedCount = salesPromises.length - validSales.length;
        console.warn(`${failedCount} sales failed to load`);
      }

    } catch (err) {
      console.error("Error fetching NFTs:", err);
      console.error("Error details:", {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        rpc,
        cw721,
        marketplace
      });
      setError(`Failed to fetch NFTs: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const buyNFT = async (saleId: string, price: string) => {
    if (!isConnected || typeof window === 'undefined') return;

    let rpc = '';
    try {
      setLoading(true);
      setError("");

      rpc = process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_CHAIN_RPC!;
      
      // Setup Keplr chain and get signer
      const offlineSigner = await setupKeplrChain();
      
      const signingClient = await getSigningClient(rpc, offlineSigner);

      const result = await signingClient.execute(
        address,
        marketplace,
        {
          buy: {
            sale_id: saleId,
          },
        },
        "auto",
        undefined,
        [{ amount: price, denom: "uandr" }]
      );

      console.log("Bought NFT!", result);
      alert("Bought successfully!");
      fetchNFTs(); // refresh
    } catch (err) {
      console.error("Error buying NFT:", err);
      console.error("Buy error details:", {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        saleId,
        price,
        rpc
      });
      setError(`Failed to buy NFT: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined' && !error && cw721 && marketplace) {
      fetchNFTs();
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="px-4 py-8 sm:px-6 sm:py-12 lg:py-16 max-w-6xl mx-auto">
        <div className="mb-12 sm:mb-16 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold text-black mb-4 sm:mb-6">Welcome to NeoSlot Marketplace</h1>
          <p className="text-gray-600 text-base sm:text-lg max-w-2xl mx-auto px-4">Discover, collect, and trade unique NFTs on the Andromeda blockchain</p>
        </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 px-4 sm:px-6 py-4 rounded-xl mb-6 sm:mb-8">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium">{error}</p>
              <div className="mt-2">
                <button
                  onClick={() => {
                    setError("");
                    fetchNFTs();
                  }}
                  className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isConnected ? (
        <WalletPrompt 
          title="Welcome to NeoSlot Marketplace"
          message="Connect your Keplr wallet to discover, collect, and trade unique NFTs on the Andromeda blockchain"
        />
      ) : (
        <div className="bg-gray-50 border border-gray-200 px-4 py-3 rounded-lg mb-6 sm:mb-8">
          <p className="text-black font-medium text-sm sm:text-base">Connected: {address}</p>
        </div>
      )}

      <div className="mt-8 sm:mt-12 lg:mt-16">
        {loading ? (
          <div className="flex flex-col sm:flex-row items-center justify-center py-16 sm:py-24">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-black mb-4 sm:mb-0"></div>
            <p className="text-black ml-0 sm:ml-4 font-medium text-center">Loading NFTs...</p>
          </div>
        ) : nfts.length === 0 ? (
          <div className="text-center py-16 sm:py-24">
            <div className="text-gray-400 mb-6">
              <svg className="w-16 h-16 sm:w-20 sm:h-20 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-black text-lg sm:text-xl font-medium mb-2">No NFTs found in the marketplace</p>
            <p className="text-gray-600 text-sm">Be the first to mint and list your NFT!</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {nfts.map((nft) => (
              <NFTCard
                key={nft.saleId}
                saleId={nft.saleId}
                tokenId={nft.tokenId}
                price={nft.price}
                seller={nft.seller}
                status={nft.status}
                coinDenom={nft.coinDenom}
                isSold={nft.isSold}
                metadata={nft.metadata}
                onBuy={() => buyNFT(nft.saleId, nft.price)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}