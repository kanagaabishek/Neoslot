"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSigningClient, getQueryClient } from '../utils/andrClient';
import { setupKeplrChain } from '../utils/keplrChain';
import WalletPrompt from '../components/WalletPrompt';
import NetworkStatus from '../components/NetworkStatus';
import DebugPanel from '../components/DebugPanel';
import { useWallet } from '../hooks/useWallet';

// Environment variables
const cw721 = process.env.NEXT_PUBLIC_CW721_ADDRESS!;
const auctionContract = process.env.NEXT_PUBLIC_AUCTION_ADDRESS || "andr1j2gwn97plye7h0xh0j2g8e7huwr6f3jqzrln64c7aqwlrg3n2ueq0p0zss";

interface AuctionNFT {
  token_id: string;
  seller: string;
  start_time: number;
  end_time: number;
  min_bid: string;
  highest_bid?: {
    bidder: string;
    amount: string;
  };
  coin_denom: string;
  status: 'active' | 'ended' | 'cancelled';
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    event_type?: string;
  };
}

interface AuctionCardProps {
  auction: AuctionNFT;
  onBid: (tokenId: string, amount: string) => void;
  loading: boolean;
  router: ReturnType<typeof useRouter>;
  formatPrice: (price: string) => string;
  formatTime: (timestamp: number, currentTime?: number) => string;
  determineStatus: (auction: AuctionNFT, currentTime?: number) => 'active' | 'ended' | 'cancelled';
}

function AuctionCard({ 
  auction,
  onBid,
  loading,
  router,
  formatPrice,
  formatTime,
  determineStatus
}: AuctionCardProps) {
  const [bidAmount, setBidAmount] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now() / 1000);

  // Update current time every second for dynamic countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now() / 1000);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleCardClick = () => {
    router.push(`/auction/${auction.token_id}`);
  };

  const handleBidClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (bidAmount && parseFloat(bidAmount) > 0) {
      const bidInMicroAndr = (parseFloat(bidAmount) * 1_000_000).toString();
      onBid(auction.token_id, bidInMicroAndr);
      setBidAmount("");
    }
  };

  // Use dynamic status determination
  const currentStatus = determineStatus(auction, currentTime);
  console.log('AuctionCard status check:', {
    tokenId: auction.token_id,
    currentTime,
    startTime: auction.start_time,
    endTime: auction.end_time,
    currentStatus,
    staticStatus: auction.status
  });
  const isActive = currentStatus === 'active';
  const timeRemaining = formatTime(auction.end_time, currentTime);
  
  // Calculate minimum bid dynamically
  const getMinimumBid = () => {
    if (auction.highest_bid) {
      const currentHighest = parseInt(auction.highest_bid.amount) / 1000000;
      return (currentHighest + 0.000001).toFixed(6); // Add 1 micro ANDR
    }
    return (parseInt(auction.min_bid) / 1000000).toFixed(6);
  };

  const getMinimumBidDisplay = () => {
    if (auction.highest_bid) {
      const currentHighest = parseInt(auction.highest_bid.amount);
      const increment = 1; // 1 micro ANDR
      return formatPrice((currentHighest + increment).toString());
    }
    return formatPrice(auction.min_bid);
  };

  return (
    <div 
      className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all cursor-pointer overflow-hidden"
      onClick={handleCardClick}
    >
      {/* Image */}
      <div className="relative h-48 bg-gray-100 overflow-hidden">
        {auction.metadata?.image ? (
          <img 
            src={auction.metadata.image} 
            alt={auction.metadata.name || `Token ${auction.token_id}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span className="text-4xl">🖼️</span>
          </div>
        )}
        
        {/* Status Badge */}
        <div className={`absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-medium ${
          currentStatus === 'ended' ? 'bg-green-100 text-green-800' :'bg-red-100 text-red-800'
          // 'bg-gray-100 text-gray-800'
        }`}>
          {currentStatus === 'active' ? 'ACTIVE' :
           currentStatus === 'ended' ? 'ACTIVE' :
           'CANCELLED'}
        </div>

        {/* Event Type Badge */}
        {auction.metadata?.event_type && (
          <div className="absolute top-3 right-3 bg-black text-white px-2 py-1 rounded-full text-xs font-medium">
            {auction.metadata.event_type}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-black mb-2">
          {auction.metadata?.name || `NFT # ${auction.token_id}`}
        </h3>
        
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
          {auction.metadata?.description || 'No description available'}
        </p>

        {/* Auction Details */}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Next Min Bid:</span>
            <span className="font-medium text-black">{getMinimumBidDisplay()}</span>
          </div>
          
          {auction.highest_bid && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Current Highest:</span>
              <span className="font-medium text-green-600">
                {formatPrice(auction.highest_bid.amount)}
              </span>
            </div>
          )}
          
          {/* <div className="flex justify-between text-sm">
            <span className="text-gray-500">Time:</span>
            <span className={`font-medium ${
              isActive ? 'text-green-600' : 'text-red-600'
            }`}>
              {timeRemaining}
            </span>
          </div> */}
        </div>

        {/* Bidding Section */}
        {isActive && (
          <div className="border-t border-gray-200 pt-3">
            <div className="flex gap-2">
              <input
                type="number"
                step="0.000001"
                min={getMinimumBid()}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                placeholder={`Min: ${getMinimumBid()}`}
              />
              <button
                onClick={handleBidClick}
                disabled={loading || !bidAmount}
                className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                Bid
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuctionPage() {
  const router = useRouter();
  const { address, isConnected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [auctions, setAuctions] = useState<AuctionNFT[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'ended' | 'cancelled'>('all');
  const [currentTime, setCurrentTime] = useState(Date.now() / 1000);
  
  // Debug panel states
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  // Update current time every second for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now() / 1000);
    }, 1000);

    return () => clearInterval(interval);
  }, []);
  
  const addDebugLog = (message: string) => {
    setDebugLogs(prev => [...prev, message]);
    console.log("AUCTION_DEBUG:", message);
  };

  // Load auctions
  const loadAuctions = useCallback(async () => {
    setLoading(true);
    setError("");
    addDebugLog("Loading auctions...");

    try {
      const rpc = process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_CHAIN_RPC || 'https://rpc.testnet.andromedaprotocol.io';
      const queryClient = await getQueryClient(rpc);
      
      // Query active auctions using correct Andromeda format
      const auctionsQuery = { 
        auction_infos_for_address: {
          token_address: cw721,
          limit: 50
        }
      };
      addDebugLog(`Querying auctions from contract: ${auctionContract}`);
      
      const auctionsResult = await queryClient.queryContractSmart(auctionContract, auctionsQuery);
      addDebugLog(`Found ${auctionsResult?.length || 0} auctions`);
      
      // Load metadata for each auction
      const auctionsWithMetadata = await Promise.all(
        (auctionsResult || []).map(async (auction: Record<string, unknown>) => {
          try {
            // Get detailed auction state if we have auction_id
            let auctionDetails = auction;
            if (auction.auction_id) {
              try {
                const detailedState = await queryClient.queryContractSmart(auctionContract, {
                  auction_state: { auction_id: auction.auction_id }
                });
                auctionDetails = { ...auction, ...detailedState };
              } catch (err) {
                addDebugLog(`Could not get detailed state for auction ${auction.auction_id}`);
              }
            }
            
            // Try to get token metadata if we have token_id
            let metadata = {};
            if (auctionDetails.token_id) {
              try {
                const tokenQuery = { nft_info: { token_id: auctionDetails.token_id } };
                const tokenInfo = await queryClient.queryContractSmart(cw721, tokenQuery);
                
                // Use the same metadata parsing logic as the details page
                metadata = tokenInfo?.extension || tokenInfo?.token_uri ? (() => {
                  try {
                    return typeof tokenInfo.token_uri === 'string' ? JSON.parse(tokenInfo.token_uri) : tokenInfo.extension || {};
                  } catch {
                    return { name: tokenInfo.token_uri };
                  }
                })() : {};
                
                addDebugLog(`Loaded metadata for token ${auctionDetails.token_id}: ${JSON.stringify(metadata)}`);
              } catch (err) {
                addDebugLog(`Could not get metadata for token ${auctionDetails.token_id}: ${err}`);
              }
            }
            
            return {
              ...auctionDetails,
              metadata,
              status: determineAuctionStatus(auctionDetails),
              // Preserve original time values for proper processing in determineAuctionStatus
              start_time: auctionDetails.start_time || auction.start_time || 0,
              end_time: auctionDetails.end_time || auction.end_time || 0,
              token_id: auctionDetails.token_id || auction.token_id || 'unknown',
              seller: auctionDetails.seller || auction.seller || 'unknown',
              min_bid: auctionDetails.min_bid || auction.min_bid || '0',
              highest_bid: auctionDetails.highest_bid || auction.highest_bid,
              coin_denom: auctionDetails.coin_denom || auction.coin_denom || 'uandr'
            };
          } catch (err) {
            addDebugLog(`Error loading auction details: ${err}`);
            return {
              ...auction,
              status: determineAuctionStatus(auction),
              // Preserve original time values for proper processing in determineAuctionStatus
              start_time: auction.start_time || 0,
              end_time: auction.end_time || 0,
              token_id: auction.token_id || 'unknown',
              seller: auction.seller || 'unknown',
              min_bid: auction.min_bid || '0',
              coin_denom: auction.coin_denom || 'uandr'
            };
          }
        })
      );
      
      setAuctions(auctionsWithMetadata);
      addDebugLog("✅ Auctions loaded successfully");
      
    } catch (err: unknown) {
      console.error("Error loading auctions:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      addDebugLog(`❌ Error loading auctions: ${errorMessage}`);
      setError(`Failed to load auctions: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const determineAuctionStatus = (auction: AuctionNFT | Record<string, unknown>, currentTime?: number): 'active' | 'ended' | 'cancelled' => {
    const now = currentTime || Date.now() / 1000;
    
    // Handle different time formats from blockchain
    let startTime = 0;
    let endTime = 0;
    
    // Convert start_time to number and normalize
    if (typeof auction.start_time === 'number') {
      startTime = auction.start_time;
    } else if (typeof auction.start_time === 'string' && auction.start_time !== '') {
      startTime = parseFloat(auction.start_time);
    }
    
    // Convert end_time to number and normalize  
    if (typeof auction.end_time === 'number') {
      endTime = auction.end_time;
    } else if (typeof auction.end_time === 'string' && auction.end_time !== '') {
      endTime = parseFloat(auction.end_time);
    }
    
    // Normalize timestamps if they're in milliseconds or nanoseconds
    if (startTime > 1000000000000) { // Larger than year 2001 in milliseconds
      if (startTime > 1000000000000000) { // Nanoseconds
        startTime = startTime / 1000000000;
        endTime = endTime / 1000000000;
      } else { // Milliseconds
        startTime = startTime / 1000;
        endTime = endTime / 1000;
      }
    }
    
    const cancelled = 'cancelled' in auction ? auction.cancelled : false;
    
    console.log('determineAuctionStatus called:', {
      tokenId: auction.token_id || 'unknown',
      now,
      originalStartTime: auction.start_time,
      originalEndTime: auction.end_time,
      normalizedStartTime: startTime,
      normalizedEndTime: endTime,
      cancelled,
      nowReadable: new Date(now * 1000).toISOString(),
      startReadable: startTime > 0 ? new Date(startTime * 1000).toISOString() : 'Invalid',
      endReadable: endTime > 0 ? new Date(endTime * 1000).toISOString() : 'Invalid'
    });
    
    if (cancelled) return 'cancelled';
    if (endTime > 0 && now > endTime) return 'ended';
    if (startTime > 0 && endTime > 0 && now >= startTime && now <= endTime) return 'active';
    if (startTime > 0 && now < startTime) return 'active'; // Not started yet, but allow bidding
    
    // If times are invalid or zero, default to ended for safety
    const result = endTime > 0 ? 'active' : 'ended';
    console.log('Status determination result:', result);
    return result;
  };

  // Handle bidding from card
  const handleBid = async (tokenId: string, bidAmount: string) => {
    if (!isConnected || !address) return;
    
    setLoading(true);
    setError("");
    setSuccess("");
    addDebugLog(`Placing bid: ${bidAmount} for token ${tokenId}`);

    try {
      const rpc = process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_CHAIN_RPC || 'https://rpc.testnet.andromedaprotocol.io';
      
      // Setup Keplr chain and get signer
      const offlineSigner = await setupKeplrChain();
      const signingClient = await getSigningClient(rpc, offlineSigner);
      if (!signingClient) {
        throw new Error("Failed to get signing client");
      }

      const auction = auctions.find(a => a.token_id === tokenId);
      if (!auction) {
        throw new Error("Auction not found");
      }

      const bidMsg = {
        place_bid: {
          token_id: tokenId,
          token_address: cw721
        }
      };

      const funds = [{
        denom: auction.coin_denom,
        amount: bidAmount
      }];

      const result = await signingClient.execute(
        address,
        auctionContract,
        bidMsg,
        "auto",
        "Placing bid on NFT auction",
        funds
      );

      addDebugLog(`Bid placed successfully: ${result.transactionHash}`);
      setSuccess(`Bid placed successfully! Transaction: ${result.transactionHash}`);
      
      // Reload auctions to show updated state
      await loadAuctions();
      
    } catch (err: unknown) {
      console.error("Error placing bid:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      addDebugLog(`Bid error: ${errorMessage}`);
      setError(`Failed to place bid: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: string) => {
    const priceNum = parseInt(price) / 1000000;
    return `${priceNum.toFixed(6)} ANDR`;
  };

  const formatTimeRemaining = (endTime: number, currentTime?: number) => {
    const now = currentTime || Date.now() / 1000;
    const remaining = endTime;
    
    if (remaining <= 0) return "Ended";
    
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = Math.floor(remaining % 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  useEffect(() => {
    if (isConnected) {
      loadAuctions();
    }
  }, [isConnected, loadAuctions]);

  // Filter auctions based on selected status (dynamic)
  const filteredAuctions = auctions.filter(auction => {
    if (statusFilter === 'all') return true;
    const currentStatus = determineAuctionStatus(auction, currentTime);
    return currentStatus === statusFilter;
  });

  // Get counts for each status (dynamic)
  const statusCounts = {
    all: auctions.length,
    active: auctions.filter(a => determineAuctionStatus(a, currentTime) === 'active').length,
    ended: auctions.filter(a => determineAuctionStatus(a, currentTime) === 'ended').length,
    cancelled: auctions.filter(a => determineAuctionStatus(a, currentTime) === 'cancelled').length
  };

  if (!isConnected) {
    return <WalletPrompt />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-4">
            <div>
              <h1 className="text-4xl font-bold text-black mb-2">Live Auctions</h1>
              <p className="text-gray-600">
                {statusFilter === 'all' 
                  ? `${auctions.length} total auctions available`
                  : `${filteredAuctions.length} ${statusFilter} auctions of ${auctions.length} total`
                }
              </p>
            </div>
            <button 
              onClick={() => router.push('/auction/mint')}
              className="bg-black text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-all whitespace-nowrap"
            >
              Create Auction
            </button>
          </div>
          
          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-gray-700 font-medium mr-2 hidden sm:block">Filter:</span>
            {[
              { key: 'all', label: 'All Auctions', icon: '🏷️', shortLabel: 'All' },
              { key: 'active', label: 'Active', icon: '🟢', shortLabel: 'Active' },
              { key: 'ended', label: 'Ended', icon: '🔴', shortLabel: 'Ended' },
              { key: 'cancelled', label: 'Cancelled', icon: '⏸️', shortLabel: 'Cancelled' }
            ].map(({ key, label, icon, shortLabel }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key as typeof statusFilter)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium transition-all ${
                  statusFilter === key
                    ? 'bg-black text-white shadow-lg'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {/* <span>{icon}</span> */}
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{shortLabel}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  statusFilter === key 
                    ? 'bg-white/20 text-white' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {statusCounts[key as keyof typeof statusCounts]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-300 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-300 rounded-lg p-4">
            <p className="text-green-800">{success}</p>
          </div>
        )}

        <div className="mb-6 flex justify-between items-center">
          <button
            onClick={loadAuctions}
            disabled={loading}
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Loading...' : 'Refresh Auctions'}
          </button>
        </div>

        {/* Auctions Grid */}
        {filteredAuctions.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-600 text-lg mb-4">
              {auctions.length === 0 
                ? "No auctions found"
                : `No ${statusFilter === 'all' ? '' : statusFilter} auctions found`
              }
            </div>
            {auctions.length === 0 ? (
              <button
                onClick={() => router.push('/auction/mint')}
                className="bg-black text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-all"
              >
                Create First Auction
              </button>
            ) : (
              <button
                onClick={() => setStatusFilter('all')}
                className="bg-gray-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-all"
              >
                Show All Auctions
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAuctions.map((auction) => (
              <AuctionCard
                key={auction.token_id}
                auction={auction}
                onBid={handleBid}
                loading={loading}
                formatPrice={formatPrice}
                formatTime={formatTimeRemaining}
                router={router}
                determineStatus={determineAuctionStatus}
              />
            ))}
          </div>
        )}
      </div>

      {/* Network Status */}
      <NetworkStatus rpcUrl={process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.testnet.andromedaprotocol.io'} />

      {/* Debug Panel */}
      {process.env.NODE_ENV === 'development' && (
        <DebugPanel
          logs={debugLogs}
          isVisible={showDebug}
          onToggle={() => setShowDebug(!showDebug)}
          onClear={() => setDebugLogs([])}
        />
      )}
    </div>
  );
}
