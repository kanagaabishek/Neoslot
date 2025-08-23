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
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4 text-black">NeoSlot</h1>
        <p className="text-gray-600 mb-6">NFT Marketplace & Auction Platform</p>
        
        <WalletPrompt />
        
        {isConnected && (
          <div className="flex flex-wrap gap-4 justify-center mt-6">
            <button
              onClick={mintNFT}
              disabled={loading}
              className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              Quick Mint
            </button>
            <Link
              href="/mint"
              className="px-6 py-2 bg-gray-100 text-black rounded-lg hover:bg-gray-200 no-underline"
            >
              Advanced Mint
            </Link>
            <Link
              href="/profile"
              className="px-6 py-2 bg-gray-100 text-black rounded-lg hover:bg-gray-200 no-underline"
            >
              My Profile
            </Link>
            <Link
              href="/auction"
              className="px-6 py-2 bg-gray-100 text-black rounded-lg hover:bg-gray-200 no-underline"
            >
              Auctions
            </Link>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="text-red-800">
            <strong>Connection Error:</strong>
            <p className="mt-1">{error}</p>
            <button
              onClick={fetchNFTs}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
          <p className="mt-2 text-gray-600">Loading NFT marketplace...</p>
        </div>
      )}

      {!loading && (
        <>
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-black">
              Available NFTs {availableNFTs.length > 0 && `(${availableNFTs.length})`}
            </h2>
            
            {availableNFTs.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500 mb-4">No NFTs currently available</p>
                <button
                  onClick={fetchNFTs}
                  className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
                >
                  Refresh
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

          {soldNFTs.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 text-black">
                Recently Sold ({soldNFTs.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {soldNFTs.map((nft) => (
                  <NFTCard
                    key={`${nft.saleId}-${nft.tokenId}-sold`}
                    saleId={nft.saleId}
                    tokenId={nft.tokenId}
                    price={nft.price}
                    seller={nft.seller}
                    status={nft.status}
                    coinDenom={nft.coinDenom}
                    isSold={true}
                    metadata={nft.metadata}
                    onBuy={() => {}}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!loading && nfts.length > 0 && (
        <div className="mt-8 bg-white rounded-lg border p-6 text-center">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-2xl font-bold text-black">{nfts.length}</div>
              <div className="text-sm text-gray-600">Total NFTs</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-black">{availableNFTs.length}</div>
              <div className="text-sm text-gray-600">Available</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-black">{soldNFTs.length}</div>
              <div className="text-sm text-gray-600">Sold</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-black">
                {new Set(nfts.map(nft => nft.seller)).size}
              </div>
              <div className="text-sm text-gray-600">Active Sellers</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
