"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSigningClient, getQueryClient } from '../../utils/andrClient';
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
  const [currentTime, setCurrentTime] = useState(Date.now() / 1000);
  
  // Debug panel states
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  // Update current time every second for dynamic countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now() / 1000);
    }, 1000);

    return () => clearInterval(interval);
  }, []);
  
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
      // Use automatic fallback logic - don't pass specific RPC URL
      const queryClient = await getQueryClient();
      
      // Try multiple approaches to find the auction
      let auctionDetails = null;
      let foundAuctionId = null;
      
      // Method 1: Try auction_ids query first
      try {
        addDebugLog(`Trying direct auction_ids query for token: ${tokenId}`);
        const auctionIdsResult = await queryClient.queryContractSmart(auctionContract, {
          auction_ids: {
            token_id: tokenId,
            token_address: cw721
          }
        });
        
        addDebugLog(`auction_ids result: ${JSON.stringify(auctionIdsResult)}`);
        
        if (auctionIdsResult && auctionIdsResult.auction_ids && auctionIdsResult.auction_ids.length > 0) {
          foundAuctionId = auctionIdsResult.auction_ids[0];
          addDebugLog(`Found auction ID: ${foundAuctionId}`);
        }
      } catch (err) {
        addDebugLog(`auction_ids query failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      
      // Method 2: If direct query failed, try listing all auctions
      if (!foundAuctionId) {
        try {
          addDebugLog("Trying to list all auctions to find matching token");
          const auctionsQuery = {
            auction_infos_for_address: {
              token_address: cw721,
              limit: 100
            }
          };
          
          const auctionsResult = await queryClient.queryContractSmart(auctionContract, auctionsQuery);
          addDebugLog(`Found ${auctionsResult?.length || 0} total auctions`);
          
          // Find the auction for this specific token
          for (const auction of (auctionsResult || [])) {
            if (auction.auction_id) {
              try {
                // Get detailed auction state
                const detailedState = await queryClient.queryContractSmart(auctionContract, {
                  auction_state: { auction_id: auction.auction_id }
                });
                
                // Check if this auction is for our token
                if (detailedState.token_id === tokenId) {
                  foundAuctionId = auction.auction_id;
                  auctionDetails = detailedState;
                  addDebugLog(`Found matching auction ${auction.auction_id} for token ${tokenId}`);
                  break;
                }
              } catch (err) {
                addDebugLog(`Could not get detailed state for auction ${auction.auction_id}`);
              }
            }
          }
        } catch (err) {
          addDebugLog(`auction_infos_for_address query failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      
      // Method 3: Try latest_auction_state query
      if (!auctionDetails && !foundAuctionId) {
        try {
          addDebugLog("Trying latest_auction_state query");
          auctionDetails = await queryClient.queryContractSmart(auctionContract, {
            latest_auction_state: {
              token_id: tokenId,
              token_address: cw721
            }
          });
          addDebugLog(`latest_auction_state result: ${JSON.stringify(auctionDetails)}`);
        } catch (err) {
          addDebugLog(`latest_auction_state query failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      
      // If we found an auction ID but no details yet, get the details
      if (foundAuctionId && !auctionDetails) {
        try {
          auctionDetails = await queryClient.queryContractSmart(auctionContract, {
            auction_state: { auction_id: foundAuctionId }
          });
          addDebugLog(`Got auction details for ID ${foundAuctionId}: ${JSON.stringify(auctionDetails)}`);
        } catch (err) {
          addDebugLog(`Failed to get auction state for ID ${foundAuctionId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      
      if (!auctionDetails) {
        throw new Error(`No auction found for token ${tokenId}. This token may not have an active auction.`);
      }
      
      // Query NFT metadata
      const metadataQuery = {
        nft_info: { token_id: tokenId }
      };
      
      const nftInfo = await queryClient.queryContractSmart(cw721, metadataQuery);
      addDebugLog(`NFT metadata response: ${JSON.stringify(nftInfo)}`);
      
      // Combine auction and metadata info with proper validation
      const startTime = typeof auctionDetails.start_time === 'number' && isFinite(auctionDetails.start_time) 
        ? auctionDetails.start_time 
        : Date.now() / 1000; // Default to now if invalid
      
      const endTime = typeof auctionDetails.end_time === 'number' && isFinite(auctionDetails.end_time) 
        ? auctionDetails.end_time 
        : (Date.now() / 1000) + 86400; // Default to 24 hours from now if invalid
      
      const auctionDetailsResult: AuctionDetails = {
        token_id: tokenId,
        seller: auctionDetails.seller || 'Unknown',
        start_time: startTime,
        end_time: endTime,
        min_bid: auctionDetails.min_bid?.amount || auctionDetails.min_bid || '0',
        highest_bid: auctionDetails.highest_bid ? {
          bidder: auctionDetails.highest_bid.bidder || 'Unknown',
          amount: auctionDetails.highest_bid.amount || '0'
        } : undefined,
        coin_denom: auctionDetails.coin_denom || 'uandr',
        status: determineAuctionStatus(auctionDetails, Date.now() / 1000),
        metadata: nftInfo?.extension || nftInfo?.token_uri ? (() => {
          try {
            return typeof nftInfo.token_uri === 'string' ? JSON.parse(nftInfo.token_uri) : nftInfo.extension || {};
          } catch {
            return { name: nftInfo.token_uri };
          }
        })() : {}
      };
      
      addDebugLog(`Final auction result: ${JSON.stringify({
        ...auctionDetailsResult,
        current_time: Date.now() / 1000,
        start_time_formatted: auctionDetailsResult.start_time > 0 
          ? new Date(auctionDetailsResult.start_time * 1000).toISOString() 
          : 'Invalid time',
        end_time_formatted: auctionDetailsResult.end_time > 0 
          ? new Date(auctionDetailsResult.end_time * 1000).toISOString() 
          : 'Invalid time'
      })}`);
      
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

  const determineAuctionStatus = (auctionInfo: Record<string, unknown>, currentTime?: number): 'active' | 'ended' | 'cancelled' => {
    const now = currentTime || Date.now() / 1000;
    
    // Handle different time formats from blockchain
    let startTime = 0;
    let endTime = 0;
    
    // Convert start_time to number and normalize
    if (typeof auctionInfo.start_time === 'number') {
      startTime = auctionInfo.start_time;
    } else if (typeof auctionInfo.start_time === 'string' && auctionInfo.start_time !== '') {
      startTime = parseFloat(auctionInfo.start_time);
    }
    
    // Convert end_time to number and normalize  
    if (typeof auctionInfo.end_time === 'number') {
      endTime = auctionInfo.end_time;
    } else if (typeof auctionInfo.end_time === 'string' && auctionInfo.end_time !== '') {
      endTime = parseFloat(auctionInfo.end_time);
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
    
    const cancelled = auctionInfo.cancelled || false;
    
    console.log('determineAuctionStatus (details page) called:', {
      tokenId: auctionInfo.token_id || 'unknown',
      now,
      originalStartTime: auctionInfo.start_time,
      originalEndTime: auctionInfo.end_time,
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
    console.log('Status determination result (details):', result);
    return result;
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

  const formatTimeRemaining = (endTime: number, currentTime?: number) => {
    // Validate the endTime value
    if (!endTime || endTime <= 0 || !isFinite(endTime)) {
      return "Invalid time";
    }
    
    const now = currentTime || Date.now() / 1000;
    const remaining = endTime - now;
    
    if (remaining <= 0) return "Ended";
    
    // Ensure remaining is a valid number
    if (!isFinite(remaining)) {
      return "Invalid time";
    }
    
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = Math.floor(remaining % 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  // Determine dynamic status and bidding/claiming conditions
  const dynamicStatus = auction ? determineAuctionStatus({
    start_time: auction.start_time,
    end_time: auction.end_time,
    cancelled: false // We would need to track this from the contract
  }, currentTime) : 'active';

  // Determine if user can bid (auction is active, not the seller, and within time bounds)
  const canBid = auction && 
                dynamicStatus === 'active' && 
                isConnected && 
                address !== auction.seller &&
                auction.end_time > 0 &&
                auction.end_time > currentTime &&
                auction.start_time <= currentTime;
  
  // Add debug logging for bidding logic
  if (auction) {
    console.log('Bidding logic check (dynamic):', {
      dynamicStatus: dynamicStatus,
      staticStatus: auction.status,
      isConnected,
      isNotSeller: address !== auction.seller,
      endTimeValid: auction.end_time > 0,
      notExpired: auction.end_time > currentTime,
      started: auction.start_time <= currentTime,
      canBid,
      currentTime: currentTime,
      endTime: auction.end_time,
      startTime: auction.start_time
    });
  }

  // Determine if user can claim (won the auction)
  const canClaim = auction && 
                  dynamicStatus === 'ended' && 
                  auction.highest_bid && 
                  auction.highest_bid.bidder === address;

  if (!isConnected) {
    return <WalletPrompt />;
  }

  if (loading && !auction) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-black text-xl">Loading auction details...</div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-black text-xl mb-4">Auction not found</div>
          <button
            onClick={() => router.push('/auction')}
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Back to Auctions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Navigation */}
      {/* Second Navigation Removed! */}
      {/* <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button 
                onClick={() => router.push('/')}
                className="text-black text-xl font-bold hover:text-gray-600 transition-colors"
              >
                NeoSlot
              </button>
              <button 
                onClick={() => router.push('/auction')}
                className="ml-8 text-gray-600 hover:text-black transition-colors"
              >
                ← Back to Auctions
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-600 text-sm">
                {address?.slice(0, 8)}...{address?.slice(-6)}
              </span>
            </div>
          </div>
        </div>
      </nav> */}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* NFT Image and Basic Info */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              {auction.metadata?.image ? (
                <img 
                  src={auction.metadata.image} 
                  alt={auction.metadata.name || `Token ${tokenId}`}
                  className="w-full h-96 object-cover rounded-xl"
                />
              ) : (
                <div className="w-full h-96 bg-gray-100 rounded-xl flex items-center justify-center">
                  <span className="text-gray-500 text-lg">No Image</span>
                </div>
              )}
              
              <div className="mt-4">
                <h1 className="text-3xl font-bold text-black mb-2">
                  {auction.metadata?.name || `Token #${tokenId}`}
                </h1>
                
                {auction.metadata?.event_type && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-black text-white px-3 py-1 rounded-full text-sm">
                      {auction.metadata.event_type}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      dynamicStatus === 'active' ? 'bg-green-100 text-green-800' :
                      dynamicStatus === 'ended' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {dynamicStatus.toUpperCase()}
                    </span>
                  </div>
                )}
                
                <p className="text-gray-600 mb-4">
                  {auction.metadata?.description || "No description available"}
                </p>
                
                {/* Event Details */}
                {auction.metadata?.event_date && (
                  <div className="space-y-2 text-sm text-gray-600">
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
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-black mb-4">Auction Details</h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Time Remaining:</span>
                  <span className="text-black font-semibold">
                    {formatTimeRemaining(auction.end_time, currentTime)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Next Min Bid:</span>
                  <span className="text-black font-semibold">
                    {auction.highest_bid ? 
                      (((parseInt(auction.highest_bid.amount) + 1) / 1000000).toFixed(6) + ' ' + auction.coin_denom) :
                      ((parseInt(auction.min_bid) / 1000000).toFixed(6) + ' ' + auction.coin_denom)
                    }
                  </span>
                </div>
                
                {auction.highest_bid && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Highest Bid:</span>
                    <div className="text-right">
                      <div className="text-black font-semibold">
                        {(parseInt(auction.highest_bid.amount) / 1000000).toFixed(6)} {auction.coin_denom}
                      </div>
                      <div className="text-gray-500 text-sm">
                        by {auction.highest_bid.bidder?.slice(0, 8) || 'Unknown'}...{auction.highest_bid.bidder?.slice(-6) || ''}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Seller:</span>
                  <span className="text-black font-mono text-sm">
                    {auction.seller?.slice(0, 8) || 'Unknown'}...{auction.seller?.slice(-6) || ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Bidding Interface */}
            {canBid && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="text-xl font-bold text-black mb-4">Place Your Bid</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
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
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                      placeholder={`Minimum: ${auction.highest_bid ? 
                        ((parseInt(auction.highest_bid.amount) / 1000000) + 0.000001).toFixed(6) :
                        (parseInt(auction.min_bid) / 1000000).toFixed(6)
                      }`}
                    />
                  </div>
                  
                  <button
                    onClick={placeBid}
                    disabled={bidLoading || !bidAmount}
                    className="w-full bg-black text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {bidLoading ? "Placing Bid..." : "Place Bid"}
                  </button>
                </div>
              </div>
            )}

            {/* Claim Interface */}
            {canClaim && (
              <div className="bg-white rounded-2xl border border-green-300 p-6">
                <h3 className="text-xl font-bold text-green-600 mb-4">🎉 Congratulations!</h3>
                <p className="text-gray-600 mb-4">
                  You won this auction! Click below to claim your NFT.
                </p>
                
                <button
                  onClick={claimAuction}
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
      <NetworkStatus />

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
