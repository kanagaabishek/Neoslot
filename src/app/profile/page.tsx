"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getQueryClient, getSigningClient } from '../utils/andrClient';
import { setupKeplrChain } from '../utils/keplrChain';
import WalletPrompt from '../components/WalletPrompt';
import { useWallet } from '../hooks/useWallet';

// Environment variables
const cw721 = process.env.NEXT_PUBLIC_CW721_ADDRESS!;
const marketplace = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS!;
const auctionContract = process.env.NEXT_PUBLIC_AUCTION_ADDRESS!;

interface UserNFT {
  tokenId: string;
  name?: string;
  description?: string;
  image?: string;
  metadata?: Record<string, unknown>;
  saleInfo?: {
    saleId: string;
    price: string;
    status: string;
    seller: string;
    coinDenom: string;
  };
}

interface UserStats {
  totalNFTs: number;
  listedNFTs: number;
  soldNFTs: number;
  totalEarnings: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { address, isConnected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userNFTs, setUserNFTs] = useState<UserNFT[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    totalNFTs: 0,
    listedNFTs: 0,
    soldNFTs: 0,
    totalEarnings: "0"
  });
  const [activeTab, setActiveTab] = useState<'owned' | 'listed' | 'sold'>('owned');
  
  // Listing modal state
  const [showListingModal, setShowListingModal] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState<UserNFT | null>(null);
  const [listingPrice, setListingPrice] = useState('');
  const [listingLoading, setListingLoading] = useState(false);
  const [listingError, setListingError] = useState('');

  // Auction modal state
  const [showAuctionModal, setShowAuctionModal] = useState(false);
  const [auctionMinBid, setAuctionMinBid] = useState('');
  const [auctionDuration, setAuctionDuration] = useState('24'); // hours
  const [auctionLoading, setAuctionLoading] = useState(false);
  const [auctionError, setAuctionError] = useState('');

  const fetchUserNFTs = async () => {
    if (!isConnected || !address || typeof window === 'undefined') return;
    
    try {
      setLoading(true);
      setError("");
      
      const rpc = process.env.NEXT_PUBLIC_CHAIN_RPC!;
      const client = await getQueryClient(rpc);

      // Get all tokens owned by user
      console.log('Fetching NFTs for user:', address);
      
      const tokensResponse = await client.queryContractSmart(cw721, {
        tokens: {
          owner: address,
          start_after: null,
          limit: 100
        }
      });

      const tokenIds = tokensResponse.tokens || [];
      console.log('Found tokens:', tokenIds);

      // Fetch details for each token
      const nftPromises = tokenIds.map(async (tokenId: string) => {
        try {
          // Get token info
          const tokenInfo = await client.queryContractSmart(cw721, {
            nft_info: { token_id: tokenId }
          });

          let metadata: Record<string, unknown> = {};
          
          // Parse metadata
          if (tokenInfo.token_uri) {
            try {
              metadata = JSON.parse(tokenInfo.token_uri);
            } catch {
              metadata = { name: tokenInfo.token_uri };
            }
          }
          
          if (tokenInfo.extension) {
            metadata = { ...metadata, ...tokenInfo.extension };
          }

          // Check if there's a sale for this NFT
          let saleInfo = null;
          try {
            const saleIdsResponse = await client.queryContractSmart(marketplace, {
              sale_ids: { 
                token_address: cw721,
                token_id: tokenId
              }
            });
            
            if (saleIdsResponse.sale_ids && saleIdsResponse.sale_ids.length > 0) {
              const saleId = saleIdsResponse.sale_ids[0];
              const saleState = await client.queryContractSmart(marketplace, {
                sale_state: { sale_id: saleId }
              });
              
              saleInfo = {
                saleId: saleId,
                price: saleState.price,
                status: saleState.status,
                seller: saleState.recipient?.address || '',
                coinDenom: saleState.coin_denom
              };
            }
          } catch (saleError) {
            console.log('No sale found for NFT:', tokenId);
          }

          return {
            tokenId,
            name: metadata.name,
            description: metadata.description,
            image: metadata.image,
            metadata,
            saleInfo
          };

        } catch (error) {
          console.error(`Error fetching details for token ${tokenId}:`, error);
          return null;
        }
      });

      const nftResults = await Promise.all(nftPromises);
      const validNFTs = nftResults.filter((nft): nft is UserNFT => nft !== null);
      
      setUserNFTs(validNFTs);

      // Calculate user stats
      const listedNFTs = validNFTs.filter(nft => nft.saleInfo?.status === 'open').length;
      const soldNFTs = validNFTs.filter(nft => nft.saleInfo?.status === 'executed').length;
      const totalEarnings = validNFTs
        .filter(nft => nft.saleInfo?.status === 'executed')
        .reduce((total, nft) => {
          if (nft.saleInfo?.price) {
            return total + parseInt(nft.saleInfo.price);
          }
          return total;
        }, 0);

      setUserStats({
        totalNFTs: validNFTs.length,
        listedNFTs,
        soldNFTs,
        totalEarnings: totalEarnings.toString()
      });

    } catch (err) {
      console.error("Error fetching user NFTs:", err);
      setError("Failed to fetch your NFTs. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (address) {
      fetchUserNFTs();
    }
  }, [address]);

  const formatPrice = (price: string, denom: string = 'uandr') => {
    if (denom === 'uandr') {
      const andrAmount = (parseInt(price) / 1_000_000).toFixed(2);
      return `${andrAmount} ANDR`;
    }
    return `${price} ${denom}`;
  };

  const getFilteredNFTs = () => {
    switch (activeTab) {
      case 'listed':
        return userNFTs.filter(nft => nft.saleInfo?.status === 'open');
      case 'sold':
        return userNFTs.filter(nft => nft.saleInfo?.status === 'executed');
      default:
        return userNFTs;
    }
  };

  const handleNFTClick = (tokenId: string) => {
    router.push(`/nft/${tokenId}`);
  };

  // List NFT for sale function
  const listNFTForSale = async () => {
    if (!selectedNFT || !listingPrice || !isConnected || !address) return;
    
    setListingLoading(true);
    setListingError('');
    
    try {
      const rpc = process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_CHAIN_RPC!;
      
      // Setup Keplr chain and get signer
      const offlineSigner = await setupKeplrChain();
      const signingClient = await getSigningClient(rpc, offlineSigner);
      
      // Convert price to micro units (multiply by 1,000,000)
      const priceInMicroUnits = Math.floor(parseFloat(listingPrice) * 1_000_000).toString();
      
      console.log('Listing NFT for sale:', {
        tokenId: selectedNFT.tokenId,
        price: priceInMicroUnits,
        denom: 'uandr'
      });
      
      // Step 1: Send NFT to marketplace contract
      const sendNftMsg = {
        send_nft: {
          contract: marketplace,
          token_id: selectedNFT.tokenId,
          msg: btoa(JSON.stringify({
            start_sale: {
              price: priceInMicroUnits,
              coin_denom: "uandr"
            }
          }))
        }
      };
      
      console.log('Sending NFT to marketplace:', sendNftMsg);
      
      const result = await signingClient.execute(
        address,
        cw721,
        sendNftMsg,
        "auto",
        "Listing NFT for sale"
      );
      
      console.log('NFT listed successfully:', result);
      
      // Close modal and refresh NFTs
      setShowListingModal(false);
      setSelectedNFT(null);
      setListingPrice('');
      
      // Show success message
      alert(`NFT #${selectedNFT.tokenId} listed for sale successfully!`);
      
      // Refresh the NFT list
      await fetchUserNFTs();
      
    } catch (err) {
      console.error("Error listing NFT:", err);
      setListingError(`Failed to list NFT: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setListingLoading(false);
    }
  };

  // List NFT as auction function
  const listNFTAsAuction = async () => {
    if (!selectedNFT || !isConnected || !address) return;
    
    setAuctionLoading(true);
    setAuctionError('');
    
    try {
      const rpc = process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_CHAIN_RPC!;
      
      // Setup Keplr chain and get signer
      const offlineSigner = await setupKeplrChain();
      const signingClient = await getSigningClient(rpc, offlineSigner);
      
      console.log('Listing NFT for auction:', {
        tokenId: selectedNFT.tokenId
      });
      
      // Use your exact working format
      const auctionMsg = {
        start_auction: {
          coin_denom: {
            native_token: "uandr"
          },
          end_time: {
            from_now: 604800 // Your exact working value (7 days)
          },
          recipient: {
            address: address
          },
          start_time: {
            from_now: 120000 // Your exact working value (~33 hours)
          }
        }
      };
      
      console.log('Creating auction with your exact format:', auctionMsg);

      const sendNftMsg = {
        send_nft: {
          contract: auctionContract,
          token_id: selectedNFT.tokenId,
          msg: btoa(JSON.stringify(auctionMsg))
        }
      };

      console.log('Sending NFT to auction contract:', sendNftMsg);

      const result = await signingClient.execute(
        address,
        cw721,
        sendNftMsg,
        "auto",
        "Listing NFT for auction"
      );
      
      console.log('NFT listed for auction successfully:', result);
      
      // Close modal and refresh NFTs
      setShowAuctionModal(false);
      setSelectedNFT(null);
      setAuctionDuration('24');
      
      // Show success message
      alert(`NFT #${selectedNFT.tokenId} listed for auction successfully!`);
      
      // Refresh the NFT list
      await fetchUserNFTs();
      
    } catch (err) {
      console.error("Error listing NFT for auction:", err);
      setAuctionError(`Failed to list NFT for auction: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAuctionLoading(false);
    }
  };

  // Open listing modal
  const openListingModal = (nft: UserNFT) => {
    setSelectedNFT(nft);
    setListingPrice('');
    setListingError('');
    setShowListingModal(true);
  };

  // Open auction modal
  const openAuctionModal = (nft: UserNFT) => {
    setSelectedNFT(nft);
    setAuctionDuration('24');
    setAuctionError('');
    setShowAuctionModal(true);
  };

  // Close listing modal
  const closeListingModal = () => {
    setShowListingModal(false);
    setSelectedNFT(null);
    setListingPrice('');
    setListingError('');
  };

  // Close auction modal
  const closeAuctionModal = () => {
    setShowAuctionModal(false);
    setSelectedNFT(null);
    setAuctionDuration('24');
    setAuctionError('');
  };

  if (!isConnected) {
    return (
      <WalletPrompt 
        title="Your Profile"
        message="Connect your wallet to view your profile and NFT collection."
      />
    );
  }

  return (
    <div className="py-16">
      <div className="max-w-7xl mx-auto px-6">
        {/* Profile Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 mb-12">
          <div className="flex items-start space-x-8">
            {/* Avatar */}
            <div className="w-24 h-24 bg-black rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-white">
                {address.slice(4, 6).toUpperCase()}
              </span>
            </div>
            
            {/* User Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-black mb-4">My Profile</h1>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-600">Wallet Address:</span>
                  <p className="font-mono text-sm bg-gray-50 p-3 rounded mt-1 break-all">
                    {address}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Chain:</span>
                  <span className="ml-2 px-3 py-1 bg-gray-100 text-black text-xs font-medium rounded">
                    Andromeda Testnet
                  </span>
                </div>
              </div>
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchUserNFTs}
              disabled={loading}
              className="px-6 py-3 bg-white border border-black text-black rounded-lg hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 font-medium"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full"></div>
                  <span>Refreshing...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refresh</span>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-gray-100 rounded-lg">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total NFTs</p>
                <p className="text-2xl font-bold text-black">{userStats.totalNFTs}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-gray-100 rounded-lg">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Listed for Sale</p>
                <p className="text-2xl font-bold text-black">{userStats.listedNFTs}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-gray-100 rounded-lg">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Sold NFTs</p>
                <p className="text-2xl font-bold text-black">{userStats.soldNFTs}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-gray-100 rounded-lg">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Earnings</p>
                <p className="text-2xl font-bold text-black">
                  {formatPrice(userStats.totalEarnings)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl border border-gray-200 mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('owned')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'owned'
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-500 hover:text-black hover:border-gray-300'
                }`}
              >
                All NFTs ({userStats.totalNFTs})
              </button>
              <button
                onClick={() => setActiveTab('listed')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'listed'
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Listed ({userStats.listedNFTs})
              </button>
              <button
                onClick={() => setActiveTab('sold')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'sold'
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Sold ({userStats.soldNFTs})
              </button>
            </nav>
          </div>
        </div>

        {/* NFT Grid */}
        {loading ? (
          <div className="py-20 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your NFTs...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-6">
            <p className="text-black">{error}</p>
          </div>
        ) : getFilteredNFTs().length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {activeTab === 'owned' && 'No NFTs Found'}
              {activeTab === 'listed' && 'No Listed NFTs'}
              {activeTab === 'sold' && 'No Sold NFTs'}
            </h3>
            <p className="text-gray-600 mb-6">
              {activeTab === 'owned' && "You don't own any NFTs yet. Start by minting your first NFT!"}
              {activeTab === 'listed' && "You don't have any NFTs listed for sale."}
              {activeTab === 'sold' && "You haven't sold any NFTs yet."}
            </p>
            {activeTab === 'owned' && (
              <button
                onClick={() => router.push('/mint')}
                className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Mint Your First NFT
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {getFilteredNFTs().map((nft) => (
              <div
                key={nft.tokenId}
                className="bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-shadow"
                onClick={() => handleNFTClick(nft.tokenId)}
              >
                {/* NFT Image */}
                <div className="aspect-square bg-gray-200">
                  {nft.image ? (
                    <img
                      src={nft.image}
                      alt={nft.name || `NFT ${nft.tokenId}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center text-gray-500">
                        <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm">No Image</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* NFT Details */}
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-2 truncate">
                    {nft.name || `NFT #${nft.tokenId}`}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">ID: {nft.tokenId}</p>
                  
                  {nft.description && (
                    <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                      {nft.description}
                    </p>
                  )}

                  {/* Sale Status */}
                  {nft.saleInfo ? (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Price:</span>
                        <span className="font-bold">
                          {formatPrice(nft.saleInfo.price, nft.saleInfo.coinDenom)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Status:</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          nft.saleInfo.status === 'open' 
                            ? 'bg-gray-100 text-black' 
                            : 'bg-gray-200 text-gray-700'
                        }`}>
                          {nft.saleInfo.status === 'open' ? 'For Sale' : 'Sold'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-2">
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded block">
                        Not Listed
                      </span>
                      <div className="space-y-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent NFT click event
                            openListingModal(nft);
                          }}
                          className="w-full px-3 py-2 bg-black text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors"
                        >
                          List for Sale
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent NFT click event
                            openAuctionModal(nft);
                          }}
                          className="w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                        >
                          List as Auction
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Listing Modal */}
      {showListingModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          {/* Modal Backdrop */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={closeListingModal}
          ></div>
          
          {/* Modal Content */}
          <div className="relative bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                List NFT for Sale
              </h3>
              <button
                onClick={closeListingModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4">
              {selectedNFT && (
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-12 h-12 bg-gray-200 rounded">
                    {selectedNFT.image ? (
                      <img
                        src={selectedNFT.image}
                        alt={selectedNFT.name || `NFT ${selectedNFT.tokenId}`}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{selectedNFT.name || `NFT #${selectedNFT.tokenId}`}</p>
                    <p className="text-xs text-gray-500">Token ID: {selectedNFT.tokenId}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Listing Price (in ANDR)
                </label>
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  value={listingPrice}
                  onChange={(e) => setListingPrice(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                  placeholder="Enter price in ANDR (e.g. 1.5)"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Minimum price: 0.000001 ANDR
                </p>
              </div>

              {listingError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-700 text-sm">
                    {listingError}
                  </p>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={closeListingModal}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                  disabled={listingLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={listNFTForSale}
                  disabled={listingLoading || !listingPrice || parseFloat(listingPrice) <= 0}
                  className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {listingLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Listing...</span>
                    </div>
                  ) : (
                    'List NFT'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auction Modal */}
      {showAuctionModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          {/* Modal Backdrop */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={closeAuctionModal}
          ></div>
          
          {/* Modal Content */}
          <div className="relative bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                List NFT for Auction
              </h3>
              <button
                onClick={closeAuctionModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4">
              {selectedNFT && (
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-12 h-12 bg-gray-200 rounded">
                    {selectedNFT.image ? (
                      <img
                        src={selectedNFT.image}
                        alt={selectedNFT.name || `NFT ${selectedNFT.tokenId}`}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{selectedNFT.name || `NFT #${selectedNFT.tokenId}`}</p>
                    <p className="text-xs text-gray-500">Token ID: {selectedNFT.tokenId}</p>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium text-blue-800">Auction Details</span>
                </div>
                <p className="text-sm text-blue-700">
                  This NFT will be listed for auction using your exact working format with a 7-day duration.
                  The minimum bid is already set from when the NFT was minted.
                </p>
              </div>

              {auctionError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-700 text-sm">
                    {auctionError}
                  </p>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={closeAuctionModal}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                  disabled={auctionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={listNFTAsAuction}
                  disabled={auctionLoading}
                  className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {auctionLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Listing...</span>
                    </div>
                  ) : (
                    'List NFT as Auction'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
