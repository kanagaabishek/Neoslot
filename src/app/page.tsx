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
  const { address, isConnected, connectWallet } = useWallet();
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
      
      // Get marketplace sales using the server API
      const salesData = await BlockchainAPI.getMarketplaceSales();
      
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
      
      setNFTs(nftSales);
      
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

  // Filter NFTs for different categories
  const availableNFTs = nfts.filter(nft => nft.status === 'open');
  const soldNFTs = nfts.filter(nft => nft.status === 'executed');

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black mb-4">
            NeoSlot
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            NFT Marketplace & Auction Platform on Andromeda
          </p>
          
          {/* Wallet Connection */}
          <WalletPrompt />
          
          {/* Action Buttons */}
          {isConnected && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              <button
                onClick={mintNFT}
                disabled={loading}
                className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Mint NFT'}
              </button>
              <Link
                href="/mint"
                className="px-6 py-3 bg-white border border-black text-black rounded-lg hover:bg-gray-50 transition-colors text-center"
              >
                Advanced Mint
              </Link>
              <Link
                href="/profile"
                className="px-6 py-3 bg-white border border-black text-black rounded-lg hover:bg-gray-50 transition-colors text-center"
              >
                My NFTs
              </Link>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <p className="font-medium">Error:</p>
            <p>{error}</p>
            <button 
              onClick={fetchNFTs}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
            <p className="mt-4 text-gray-600">Loading NFTs...</p>
          </div>
        )}

        {/* NFT Grid */}
        {!loading && (
          <>
            {/* Available NFTs Section */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-black mb-6">Available NFTs ({availableNFTs.length})</h2>
              {availableNFTs.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border">
                  <p className="text-gray-500 text-lg">No NFTs available for sale</p>
                  <button 
                    onClick={fetchNFTs}
                    className="mt-4 px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Refresh
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {availableNFTs.map((nft) => (
                    <NFTCard
                      key={`${nft.saleId}-${nft.tokenId}`}
                      saleId={nft.saleId}
                      tokenId={nft.tokenId}
                      price={nft.price}
                      seller={nft.seller}
                      status={nft.status}
                      coinDenom={nft.coinDenom}
                      isSold={false}
                      metadata={nft.metadata}
                      onBuy={() => buyNFT(nft.saleId, nft.price, nft.coinDenom)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Sold NFTs Section */}
            {soldNFTs.length > 0 && (
              <div>
                <h2 className="text-3xl font-bold text-black mb-6">Recently Sold ({soldNFTs.length})</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {soldNFTs.map((nft) => (
                    <NFTCard
                      key={`${nft.saleId}-${nft.tokenId}`}
                      saleId={nft.saleId}
                      tokenId={nft.tokenId}
                      price={nft.price}
                      seller={nft.seller}
                      status={nft.status}
                      coinDenom={nft.coinDenom}
                      isSold={true}
                      metadata={nft.metadata}
                      onBuy={() => {}} // No buy action for sold items
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Statistics */}
        {!loading && nfts.length > 0 && (
          <div className="mt-12 bg-white rounded-lg border p-6">
            <h3 className="text-xl font-bold text-black mb-4">Marketplace Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-black">{nfts.length}</p>
                <p className="text-gray-600">Total NFTs</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-black">{availableNFTs.length}</p>
                <p className="text-gray-600">Available</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-black">{soldNFTs.length}</p>
                <p className="text-gray-600">Sold</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-black">
                  {new Set(nfts.map(nft => nft.seller)).size}
                </p>
                <p className="text-gray-600">Sellers</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
