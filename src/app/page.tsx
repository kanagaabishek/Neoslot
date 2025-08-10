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
    <div className="p-10 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Welcome to NeoSlot Marketplace</h1>
        <p className="mt-2">Discover, collect, and trade unique NFTs on the Andromeda blockchain</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {!isConnected ? (
        <WalletPrompt 
          title="Welcome to NeoSlot Marketplace"
          message="Connect your Keplr wallet to discover, collect, and trade unique NFTs on the Andromeda blockchain"
        />
      ) : (
        <p className="text-emerald-600 font-medium">Connected: {address}</p>
      )}

      <div className="mt-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-blue-600 ml-3">Loading NFTs...</p>
          </div>
        ) : nfts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-slate-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-slate-500 text-lg">No NFTs found in the marketplace</p>
            <p className="text-slate-400 text-sm mt-2">Be the first to mint and list your NFT!</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                onBuy={() => buyNFT(nft.saleId, nft.price)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}