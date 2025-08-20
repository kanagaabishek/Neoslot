"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSigningClient, getQueryClient } from '../../utils/andrClient';
import { setupKeplrChain } from '../../utils/keplrChain';
import { stringifyTransactionResult } from "../../utils/serializer";
import WalletPrompt from '../../components/WalletPrompt';
import NetworkStatus from '../../components/NetworkStatus';
import DebugPanel from '../../components/DebugPanel';
import { useWallet } from '../../hooks/useWallet';

// Environment variables
const cw721 = process.env.NEXT_PUBLIC_CW721_ADDRESS!;
const auctionContract = process.env.NEXT_PUBLIC_AUCTION_ADDRESS || "andr1j2gwn97plye7h0xh0j2g8e7huwr6f3jqzrln64c7aqwlrg3n2ueq0p0zss";

interface AuctionDetails {
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
    event_date?: string;
    location?: string;
    organizer?: string;
    capacity?: number;
    benefits?: string[];
  };
  bid_history?: Array<{
    bidder: string;
    amount: string;
    timestamp: number;
  }>;
}

export default function AuctionDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const tokenId = params.tokenId as string;
  const { address, isConnected } = useWallet();
  
  const [loading, setLoading] = useState(false);
  const [bidLoading, setBidLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [auction, setAuction] = useState<AuctionDetails | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  
  // Debug panel states
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  
  const addDebugLog = (message: string) => {
    setDebugLogs(prev => [...prev, message]);
    console.log("AUCTION_DETAILS_DEBUG:", message);
  };

  // Load auction details
  const loadAuctionDetails = useCallback(async () => {
    if (!tokenId) return;
    
    setLoading(true);
    setError("");
    addDebugLog(`Loading auction details for token: ${tokenId}`);

    try {
      const rpc = process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_CHAIN_RPC || 'https://rpc.testnet.andromedaprotocol.io';
      const queryClient = await getQueryClient(rpc);
      
      // First, get all auctions for the token address
      const auctionsQuery = {
        auction_infos_for_address: {
          token_address: cw721,
          limit: 100
        }
      };
      
      addDebugLog(`Querying auctions from contract: ${auctionContract}`);
      const auctionsResult = await queryClient.queryContractSmart(auctionContract, auctionsQuery);
      addDebugLog(`Found ${auctionsResult?.length || 0} total auctions`);
      
      // Find the auction for this specific token
      let auctionInfo = null;
      let auctionDetails = null;
      
      for (const auction of (auctionsResult || [])) {
        if (auction.auction_id) {
          try {
            // Get detailed auction state
            const detailedState = await queryClient.queryContractSmart(auctionContract, {
              auction_state: { auction_id: auction.auction_id }
            });
            
            // Check if this auction is for our token
            if (detailedState.token_id === tokenId) {
              auctionInfo = auction;
              auctionDetails = detailedState;
              addDebugLog(`Found matching auction ${auction.auction_id} for token ${tokenId}`);
              break;
            }
          } catch (err) {
            addDebugLog(`Could not get detailed state for auction ${auction.auction_id}`);
          }
        }
      }
      
      if (!auctionInfo || !auctionDetails) {
        throw new Error(`No auction found for token ${tokenId}`);
      }
      
      // Query NFT metadata
      const metadataQuery = {
        nft_info: { token_id: tokenId }
      };
      
      const nftInfo = await queryClient.queryContractSmart(cw721, metadataQuery);
      addDebugLog(`NFT metadata response: ${JSON.stringify(nftInfo)}`);
      
      // Combine auction and metadata info
      const auctionDetailsResult: AuctionDetails = {
        token_id: tokenId,
        seller: auctionDetails.seller,
        start_time: auctionDetails.start_time,
        end_time: auctionDetails.end_time,
        min_bid: auctionDetails.min_bid?.amount || auctionDetails.min_bid,
        highest_bid: auctionDetails.highest_bid,
        coin_denom: auctionDetails.coin_denom,
        status: determineAuctionStatus(auctionDetails),
        metadata: nftInfo.extension || {}
      };
      
      setAuction(auctionDetailsResult);
      addDebugLog("Auction details loaded successfully");
      
    } catch (err: unknown) {
      console.error("Error loading auction details:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      addDebugLog(`Error loading auction: ${errorMessage}`);
      setError(`Failed to load auction details: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [tokenId]);

  const determineAuctionStatus = (auctionInfo: Record<string, unknown>): 'active' | 'ended' | 'cancelled' => {
    const now = Date.now() / 1000;
    const startTime = typeof auctionInfo.start_time === 'number' ? auctionInfo.start_time : 0;
    const endTime = typeof auctionInfo.end_time === 'number' ? auctionInfo.end_time : 0;
    
    if (auctionInfo.cancelled) return 'cancelled';
    if (now < startTime) return 'active'; // Not started yet, but we'll show as active
    if (now > endTime) return 'ended';
    return 'active';
  };

  // Place bid
  const placeBid = async () => {
    if (!isConnected || !address || !auction || !bidAmount) return;
    
    setBidLoading(true);
    setError("");
    setSuccess("");
    addDebugLog(`Placing bid: ${bidAmount} ${auction.coin_denom}`);

    try {
      const rpc = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.testnet.andromedaprotocol.io';
      
      // Get wallet from window.keplr
      if (!window.keplr) {
        throw new Error("Keplr wallet not found");
      }
      
      const chainId = process.env.NEXT_PUBLIC_CHAIN_ID || "galileo-4";
      const offlineSigner = window.keplr.getOfflineSigner(chainId);
      const signingClient = await getSigningClient(rpc, offlineSigner);
      if (!signingClient) {
        throw new Error("Failed to get signing client");
      }

      // Convert bid amount to proper format
      const bidAmountMicro = Math.floor(parseFloat(bidAmount) * 1000000);
      
      // Validate bid amount
      const minBid = parseInt(auction.min_bid);
      const currentHighest = auction.highest_bid ? parseInt(auction.highest_bid.amount) : minBid;
      
      if (bidAmountMicro <= currentHighest) {
        throw new Error(`Bid must be higher than current highest bid: ${currentHighest / 1000000} ${auction.coin_denom}`);
      }

      const bidMsg = {
        place_bid: {
          token_id: tokenId,
          token_address: cw721
        }
      };

      const funds = [{
        denom: auction.coin_denom,
        amount: bidAmountMicro.toString()
      }];

      addDebugLog(`Bid message: ${JSON.stringify(bidMsg)}`);
      addDebugLog(`Funds: ${JSON.stringify(funds)}`);

      const result = await signingClient.execute(
        address,
        auctionContract,
        bidMsg,
        "auto",
        "Placing bid on NFT auction",
        funds
      );

      addDebugLog(`Bid transaction result: ${stringifyTransactionResult(result)}`);
      setSuccess(`Bid placed successfully! Transaction: ${result.transactionHash}`);
      setBidAmount("");
      
      // Reload auction details to show updated bid
      await loadAuctionDetails();
      
    } catch (err: unknown) {
      console.error("Error placing bid:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      addDebugLog(`Bid error: ${errorMessage}`);
      setError(`Failed to place bid: ${errorMessage}`);
    } finally {
      setBidLoading(false);
    }
  };

  // Claim auction (for winner)
  const claimAuction = async () => {
    if (!isConnected || !address || !auction) return;
    
    setLoading(true);
    setError("");
    setSuccess("");
    addDebugLog(`Claiming auction for token: ${tokenId}`);

    try {
      const rpc = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.testnet.andromedaprotocol.io';
      
      // Get wallet from window.keplr
      if (!window.keplr) {
        throw new Error("Keplr wallet not found");
      }
      
      const chainId = process.env.NEXT_PUBLIC_CHAIN_ID || "galileo-4";
      const offlineSigner = window.keplr.getOfflineSigner(chainId);
      const signingClient = await getSigningClient(rpc, offlineSigner);
      if (!signingClient) {
        throw new Error("Failed to get signing client");
      }

      const claimMsg = {
        claim: {
          token_id: tokenId,
          token_address: cw721
        }
      };

      addDebugLog(`Claim message: ${JSON.stringify(claimMsg)}`);

      const result = await signingClient.execute(
        address,
        auctionContract,
        claimMsg,
        "auto",
        "Claiming auction NFT"
      );

      addDebugLog(`Claim transaction result: ${stringifyTransactionResult(result)}`);
      setSuccess(`Auction claimed successfully! Transaction: ${result.transactionHash}`);
      
      // Redirect to profile or marketplace
      setTimeout(() => {
        router.push('/profile');
      }, 3000);
      
    } catch (err: unknown) {
      console.error("Error claiming auction:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      addDebugLog(`Claim error: ${errorMessage}`);
      setError(`Failed to claim auction: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuctionDetails();
  }, [tokenId, loadAuctionDetails]);

  const formatTimeRemaining = (endTime: number) => {
    const now = Date.now() / 1000;
    const remaining = endTime - now;
    
    if (remaining <= 0) return "Auction ended";
    
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  const canBid = auction && auction.status === 'active' && 
                isConnected && 
                address !== auction.seller &&
                Date.now() / 1000 < auction.end_time;

  const canClaim = auction && auction.status === 'ended' && 
                  auction.highest_bid && 
                  address === auction.highest_bid.bidder;

  if (!isConnected) {
    return <WalletPrompt />;
  }

  if (loading && !auction) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading auction details...</div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Auction not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Navigation */}
      <nav className="bg-black/20 backdrop-blur-md border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button 
                onClick={() => router.push('/')}
                className="text-white text-xl font-bold hover:text-purple-300 transition-colors"
              >
                NeoSlot
              </button>
              <button 
                onClick={() => router.push('/auction')}
                className="ml-8 text-purple-300 hover:text-white transition-colors"
              >
                ← Back to Auctions
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-purple-300 text-sm">
                {address?.slice(0, 8)}...{address?.slice(-6)}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* NFT Image and Basic Info */}
          <div className="space-y-6">
            <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
              {auction.metadata?.image ? (
                <img 
                  src={auction.metadata.image} 
                  alt={auction.metadata.name || `Token ${tokenId}`}
                  className="w-full h-96 object-cover rounded-xl"
                />
              ) : (
                <div className="w-full h-96 bg-slate-800 rounded-xl flex items-center justify-center">
                  <span className="text-slate-400 text-lg">No Image</span>
                </div>
              )}
              
              <div className="mt-4">
                <h1 className="text-3xl font-bold text-white mb-2">
                  {auction.metadata?.name || `Token #${tokenId}`}
                </h1>
                
                {auction.metadata?.event_type && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-sm">
                      {auction.metadata.event_type}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      auction.status === 'active' ? 'bg-green-500/20 text-green-300' :
                      auction.status === 'ended' ? 'bg-red-500/20 text-red-300' :
                      'bg-gray-500/20 text-gray-300'
                    }`}>
                      {auction.status.toUpperCase()}
                    </span>
                  </div>
                )}
                
                <p className="text-slate-300 mb-4">
                  {auction.metadata?.description || "No description available"}
                </p>
                
                {/* Event Details */}
                {auction.metadata?.event_date && (
                  <div className="space-y-2 text-sm text-slate-300">
                    <div><strong>Date:</strong> {auction.metadata.event_date}</div>
                    {auction.metadata.location && (
                      <div><strong>Location:</strong> {auction.metadata.location}</div>
                    )}
                    {auction.metadata.organizer && (
                      <div><strong>Organizer:</strong> {auction.metadata.organizer}</div>
                    )}
                    {auction.metadata.capacity && (
                      <div><strong>Capacity:</strong> {auction.metadata.capacity} attendees</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Auction Info and Bidding */}
          <div className="space-y-6">
            {/* Auction Status */}
            <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Auction Details</h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Time Remaining:</span>
                  <span className="text-white font-semibold">
                    {formatTimeRemaining(auction.end_time)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Minimum Bid:</span>
                  <span className="text-white font-semibold">
                    {(parseInt(auction.min_bid) / 1000000).toFixed(6)} {auction.coin_denom}
                  </span>
                </div>
                
                {auction.highest_bid && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Highest Bid:</span>
                    <div className="text-right">
                      <div className="text-white font-semibold">
                        {(parseInt(auction.highest_bid.amount) / 1000000).toFixed(6)} {auction.coin_denom}
                      </div>
                      <div className="text-slate-400 text-sm">
                        by {auction.highest_bid.bidder.slice(0, 8)}...{auction.highest_bid.bidder.slice(-6)}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Seller:</span>
                  <span className="text-white font-mono text-sm">
                    {auction.seller.slice(0, 8)}...{auction.seller.slice(-6)}
                  </span>
                </div>
              </div>
            </div>

            {/* Bidding Interface */}
            {canBid && (
              <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
                <h3 className="text-xl font-bold text-white mb-4">Place Your Bid</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Bid Amount ({auction.coin_denom})
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      min={(auction.highest_bid ? 
                        (parseInt(auction.highest_bid.amount) / 1000000) + 0.000001 :
                        (parseInt(auction.min_bid) / 1000000)
                      )}
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder={`Minimum: ${auction.highest_bid ? 
                        ((parseInt(auction.highest_bid.amount) / 1000000) + 0.000001).toFixed(6) :
                        (parseInt(auction.min_bid) / 1000000).toFixed(6)
                      }`}
                    />
                  </div>
                  
                  <button
                    onClick={placeBid}
                    disabled={bidLoading || !bidAmount}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {bidLoading ? "Placing Bid..." : "Place Bid"}
                  </button>
                </div>
              </div>
            )}

            {/* Claim Interface */}
            {canClaim && (
              <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-green-500/20 p-6">
                <h3 className="text-xl font-bold text-green-300 mb-4">🎉 Congratulations!</h3>
                <p className="text-slate-300 mb-4">
                  You won this auction! Click below to claim your NFT.
                </p>
                
                <button
                  onClick={claimAuction}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Claiming..." : "Claim NFT"}
                </button>
              </div>
            )}

            {/* Benefits Section */}
            {auction.metadata?.benefits && auction.metadata.benefits.length > 0 && (
              <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-6">
                <h3 className="text-xl font-bold text-white mb-4">Benefits & Perks</h3>
                <ul className="space-y-2 text-slate-300">
                  {auction.metadata.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-purple-400 mr-2">•</span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mt-6 bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {success && (
          <div className="mt-6 bg-green-500/10 border border-green-500/50 rounded-lg p-4">
            <p className="text-green-400">{success}</p>
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
