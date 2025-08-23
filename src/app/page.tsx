'use client'
import { useEffect, useState } from "react";
import Link from "next/link";
import BlockchainAPI from "./utils/blockchainAPI";
import { getSigningClient } from "./utils/andrClient";
import { setupKeplrChain } from "./utils/keplrChain";
import NFTCard from "./components/NFTcard";
import WalletPrompt from "./components/WalletPrompt";
import { useWallet } from "./hooks/useWallet";

const cw721 = process.env.NEXT_PUBLIC_CW721_ADDRESS!;
const marketplace = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS!;

interface NFTSale {
  saleId: string;
  price: string;
  seller: string;
  status: string;
  coinDenom: string;
  tokenId: string;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    start_time?: string;
    meeting_link?: string;
    event_type?: string;
  } | null;
}

export default function Home() {
  const { address, isConnected } = useWallet();
  const [nfts, setNFTs] = useState<NFTSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchNFTs = async () => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    try {
      setLoading(true);
      setError("");
      
      console.log('Loading NFT sales via server API...');
      console.log('Marketplace address:', marketplace);
      console.log('CW721 address:', cw721);
      
      // Get marketplace sales using the server API
      const salesData = await BlockchainAPI.getMarketplaceSales();
      console.log('Raw sales data from server:', salesData);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nftSales = salesData.map((sale: any) => ({
        saleId: sale.sale_id,
        price: sale.price,
        seller: sale.recipient?.address || 'Unknown',
        status: sale.status,
        coinDenom: sale.coin_denom,
        tokenId: sale.token_id,
        metadata: sale.metadata || null
      }));
      
      console.log('Processed NFT sales:', nftSales);
      setNFTs(nftSales);
      
      // If no sales, let's also check if there are any NFTs minted at all
      if (nftSales.length === 0) {
        console.log('No active sales found. This is normal if no NFTs have been listed for sale yet.');
      }
      
    } catch (serverError) {
      console.error('Server API failed:', serverError);
      setError(`Failed to load NFT data. ${serverError instanceof Error ? serverError.message : 'Server error'}`);
    } finally {
      setLoading(false);
    }
  };

  const buyNFT = async (saleId: string, price: string, coinDenom: string) => {
    if (!isConnected || typeof window === 'undefined') return;

    try {
      setLoading(true);
      setError("");

      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_CHAIN_RPC!;
      
      // Setup Keplr chain and get signer
      const offlineSigner = await setupKeplrChain();
      
      const signingClient = await getSigningClient(rpcUrl, offlineSigner);

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
        [{ amount: price, denom: coinDenom }]
      );

      console.log("Bought NFT!", result);
      alert("NFT purchased successfully!");
      
      // Refresh the NFT list
      fetchNFTs();
      
    } catch (err) {
      console.error("Error buying NFT:", err);
      setError("Failed to buy NFT. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const mintNFT = async () => {
    if (!isConnected || typeof window === 'undefined') return;

    try {
      setLoading(true);
      setError("");

      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_CHAIN_RPC!;
      
      // Setup Keplr chain and get signer
      const offlineSigner = await setupKeplrChain();
      
      const signingClient = await getSigningClient(rpcUrl, offlineSigner);

      // Simple mint with basic metadata
      const mintMsg = {
        mint: {
          token_id: Date.now().toString(),
          owner: address,
          token_uri: JSON.stringify({
            name: `NFT #${Date.now()}`,
            description: "A test NFT from NeoSlot",
            image: "https://via.placeholder.com/400x400?text=NFT"
          })
        }
      };

      const result = await signingClient.execute(
        address,
        cw721,
        mintMsg,
        "auto"
      );

      console.log("Minted NFT!", result);
      alert("NFT minted successfully!");
      
    } catch (err) {
      console.error("Error minting NFT:", err);
      setError("Failed to mint NFT. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNFTs();
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
            <p className="text-black font-medium text-sm sm:text-base mb-3">Connected: {address}</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={mintNFT}
                disabled={loading}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 text-sm"
              >
                Quick Mint NFT
              </button>
              <Link
                href="/mint"
                className="px-4 py-2 bg-gray-200 text-black rounded-lg hover:bg-gray-300 no-underline text-sm"
              >
                Advanced Mint
              </Link>
              <Link
                href="/auction"
                className="px-4 py-2 bg-gray-200 text-black rounded-lg hover:bg-gray-300 no-underline text-sm"
              >
                Auctions
              </Link>
              <Link
                href="/profile"
                className="px-4 py-2 bg-gray-200 text-black rounded-lg hover:bg-gray-300 no-underline text-sm"
              >
                My Profile
              </Link>
            </div>
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
              <p className="text-gray-600 text-sm mb-4">The marketplace is connected to the blockchain, but no NFTs are currently listed for sale.</p>
              {isConnected && (
                <div className="mt-6">
                  <button
                    onClick={mintNFT}
                    disabled={loading}
                    className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 mr-4"
                  >
                    Mint Your First NFT
                  </button>
                  <button
                    onClick={fetchNFTs}
                    className="px-6 py-2 bg-gray-200 text-black rounded-lg hover:bg-gray-300"
                  >
                    Refresh Marketplace
                  </button>
                </div>
              )}
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
                  isSold={nft.status === 'executed'}
                  metadata={nft.metadata}
                  onBuy={() => buyNFT(nft.saleId, nft.price, nft.coinDenom)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
