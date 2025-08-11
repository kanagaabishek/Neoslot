'use client'
import { useEffect, useState } from "react";
import { getQueryClient, getSigningClient } from "./utils/andrClient";
import NFTCard from "./components/NFTcard";
import WalletPrompt from "./components/WalletPrompt";
import { useWallet } from "./hooks/useWallet";

const cw721 = process.env.NEXT_PUBLIC_CW721_ADDRESS!;
const marketplace = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS!;

export default function Home() {
  const { address, isConnected } = useWallet();
  const [nfts, setNFTs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Check if environment variables are set
  useEffect(() => {
    if (!cw721 || !marketplace) {
      setError("Missing environment variables. Please check your .env.local file.");
    }
  }, []);

  const fetchNFTs = async () => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    try {
      setLoading(true);
      setError("");
      
      const rpc = process.env.NEXT_PUBLIC_CHAIN_RPC!;
      const client = await getQueryClient(rpc);

      // Get all sales for our CW721 contract using sale_infos_for_address
      console.log('Querying marketplace for sales...');
      const saleInfosResponse = await client.queryContractSmart(marketplace, {
        sale_infos_for_address: { 
          token_address: cw721,
          start_after: null,
          limit: 50 // Get up to 50 sales
        }
      });
      
      console.log('Sale infos response:', saleInfosResponse);
      
      if (!saleInfosResponse || saleInfosResponse.length === 0) {
        console.log('No sales found');
        setNFTs([]);
        return;
      }

      // Fetch detailed sale state for each sale
      const salesPromises = saleInfosResponse.flatMap((info: any) => 
        info.sale_ids.map(async (saleId: string) => {
          try {
            const saleState = await client.queryContractSmart(marketplace, {
              sale_state: { sale_id: saleId }
            });
            
            // Fetch NFT metadata from CW721 contract
            let metadata = null;
            try {
              const nftInfo = await client.queryContractSmart(cw721, {
                nft_info: { token_id: info.token_id }
              });
              
              // Parse metadata from token_uri or extension (same as NFT details page)
              let parsedMetadata: any = {};
              
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
              tokenId: info.token_id,
              tokenAddress: info.token_address,
              price: saleState.price,
              status: saleState.status,
              seller: saleState.recipient?.address,
              coinDenom: saleState.coin_denom,
              isSold: saleState.status === 'executed',
              startTime: saleState.start_time,
              endTime: saleState.end_time,
              metadata: metadata,
              ...saleState
            };
          } catch (error) {
            console.error(`Error fetching sale ${saleId}:`, error);
            return null;
          }
        })
      );

      const salesResults = await Promise.all(salesPromises);
      const validSales = salesResults.filter(sale => sale !== null);
      
      console.log('Valid sales:', validSales);
      setNFTs(validSales);

    } catch (err) {
      console.error("Error fetching NFTs:", err);
      setError("Failed to fetch NFTs. Please check your connection and contract addresses.");
    } finally {
      setLoading(false);
    }
  };

  const buyNFT = async (saleId: string, price: string) => {
    if (!isConnected || typeof window === 'undefined') return;

    try {
      setLoading(true);
      setError("");

      const rpc = process.env.NEXT_PUBLIC_CHAIN_RPC!;
      const chainId = process.env.NEXT_PUBLIC_CHAIN_ID!;
      
      // Get wallet signer
      if (!window.keplr) {
        alert('Please install Keplr extension');
        return;
      }

      await window.keplr.enable(chainId);
      const offlineSigner = window.keplr.getOfflineSigner(chainId);
      
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
      setError("Failed to buy NFT. Please try again.");
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
    <div className="px-4 py-8 sm:px-6 sm:py-12 lg:py-16 max-w-6xl mx-auto">
      <div className="mb-12 sm:mb-16 text-center">
        <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold text-black mb-4 sm:mb-6">Welcome to NeoSlot Marketplace</h1>
        <p className="text-gray-600 text-base sm:text-lg max-w-2xl mx-auto px-4">Discover, collect, and trade unique NFTs on the Andromeda blockchain</p>
      </div>

      {error && (
        <div className="bg-gray-50 border border-gray-300 text-black px-4 sm:px-6 py-4 rounded-xl mb-6 sm:mb-8">
          {error}
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
  );
}