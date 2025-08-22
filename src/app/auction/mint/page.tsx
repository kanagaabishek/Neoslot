"use client"

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSigningClient } from '../../utils/andrClient';
import { setupKeplrChain } from '../../utils/keplrChain';
import { stringifyTransactionResult } from '../../utils/serializer';
import WalletPrompt from '../../components/WalletPrompt';
import NetworkStatus from '../../components/NetworkStatus';
import DebugPanel from '../../components/DebugPanel';
import { useWallet } from '../../hooks/useWallet';

// Environment variables
const cw721 = process.env.NEXT_PUBLIC_CW721_ADDRESS!;
const auctionContract = process.env.NEXT_PUBLIC_AUCTION_ADDRESS || "andr1j2gwn97plye7h0xh0j2g8e7huwr6f3jqzrln64c7aqwlrg3n2ueq0p0zss";

export default function AuctionMintPage() {
  const router = useRouter();
  const { address, isConnected } = useWallet();
  
  // Form states
  const [tokenName, setTokenName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [capacity, setCapacity] = useState("");
  const [benefits, setBenefits] = useState("");
  
  // Auction parameters
  const [minBid, setMinBid] = useState("");
  const [auctionDuration, setAuctionDuration] = useState("24"); // hours
  const [coinDenom, setCoinDenom] = useState("uandr");
  
  // Loading and status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Debug panel states
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  
  const addDebugLog = (message: string) => {
    setDebugLogs(prev => [...prev, message]);
    console.log("AUCTION_MINT_DEBUG:", message);
  };

  const generateUniqueTokenId = (): string => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `auction_${timestamp}_${random}`;
  };

  const mintAndCreateAuction = async () => {
    if (!isConnected || !address) return;
    
    // Validation
    if (!tokenName || !minBid || !auctionDuration) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    addDebugLog("Starting auction NFT mint and auction creation process");

    try {
      const rpc = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.testnet.andromedaprotocol.io';
      
      // Setup Keplr chain and get signer
      const offlineSigner = await setupKeplrChain();
      const signingClient = await getSigningClient(rpc, offlineSigner);
      if (!signingClient) {
        throw new Error("Failed to get signing client");
      }

      // Generate unique token ID
      const tokenId = generateUniqueTokenId();
      addDebugLog(`Generated token ID: ${tokenId}`);

      // Prepare metadata
      const metadata = {
        name: tokenName,
        description: description || `Auction NFT for ${tokenName}`,
        image: imageUrl || "",
        event_type: eventType || "auction",
        event_date: eventDate || "",
        location: location || "",
        organizer: organizer || address,
        capacity: capacity ? parseInt(capacity) : undefined,
        benefits: benefits ? benefits.split('\n').filter(b => b.trim()) : []
      };

      // Remove undefined fields
      const cleanMetadata = Object.fromEntries(
        Object.entries(metadata).filter(([, value]) => value !== "" && value !== undefined)
      );

      addDebugLog(`Metadata: ${JSON.stringify(cleanMetadata, null, 2)}`);

      // Step 1: Mint NFT
      const mintMsg = {
        mint: {
          token_id: tokenId,
          owner: address,
          token_uri: JSON.stringify(cleanMetadata),
          extension: {
            publisher: address
          }
        }
      };

      addDebugLog(`Minting NFT with message: ${JSON.stringify(mintMsg)}`);

      const mintResult = await signingClient.execute(
        address,
        cw721,
        mintMsg,
        "auto",
        "Minting auction NFT"
      );

      addDebugLog(`Mint result: ${stringifyTransactionResult(mintResult)}`);
      addDebugLog("NFT minted successfully, now sending NFT to auction contract to start auction");

      // Calculate min bid amount in micro units
      const minBidAmount = Math.floor(parseFloat(minBid) * 1000000);
      addDebugLog(`Min bid: ${minBid} ${coinDenom} = ${minBidAmount} micro units`);

      // Step 2: Send NFT to auction contract to start auction
      // Calculate auction duration and times
      const durationHours = parseInt(auctionDuration);
      
      // Calculate times in seconds (not nanoseconds like the previous attempts)
      const nowSeconds = Math.floor(Date.now() / 1000);
      const startBufferSeconds = 120; // 2 minutes buffer to avoid "start time in past" error
      const startTimeSeconds = nowSeconds + startBufferSeconds;
      const endTimeSeconds = startTimeSeconds + (durationHours * 60 * 60);
      
      addDebugLog(`Current time: ${nowSeconds} seconds (${new Date(nowSeconds * 1000).toISOString()})`);
      addDebugLog(`Auction start time: ${startTimeSeconds} seconds (${new Date(startTimeSeconds * 1000).toISOString()})`);
      addDebugLog(`Auction end time: ${endTimeSeconds} seconds (${new Date(endTimeSeconds * 1000).toISOString()})`);
      addDebugLog(`Auction duration: ${durationHours} hours`);

      const auctionMsg = {
        start_auction: {
          start_time: { 
            at_time: startTimeSeconds.toString() 
          },
          end_time: { 
            at_time: endTimeSeconds.toString() 
          },
          min_bid: {
            amount: minBidAmount.toString(),
            denom: coinDenom
          },
          coin_denom: coinDenom,
          recipient: null
        }
      };
      
      addDebugLog(`Creating auction with calculated duration: ${JSON.stringify(auctionMsg)}`);
      addDebugLog(`Duration details: ${durationHours} hours from ${startTimeSeconds} to ${endTimeSeconds}`);

      const sendNftMsg = {
        send_nft: {
          contract: auctionContract,
          token_id: tokenId,
          msg: btoa(JSON.stringify(auctionMsg))
        }
      };

      addDebugLog(`Sending NFT to auction contract: ${JSON.stringify(sendNftMsg)}`);

      const sendResult = await signingClient.execute(
        address,
        cw721,
        sendNftMsg,
        "auto",
        "Sending NFT to auction contract"
      );

      addDebugLog(`Auction created successfully! Send NFT result: ${stringifyTransactionResult(sendResult)}`);

      setSuccess(`Auction created successfully! Token ID: ${tokenId}`);
      
      // Reset form
      setTokenName("");
      setDescription("");
      setImageUrl("");
      setEventType("");
      setEventDate("");
      setLocation("");
      setOrganizer("");
      setCapacity("");
      setBenefits("");
      setMinBid("");
      setAuctionDuration("24");
      
      // Redirect to auction page after success
      setTimeout(() => {
        router.push(`/auction/${tokenId}`);
      }, 3000);

    } catch (err: unknown) {
      console.error("Error creating auction NFT:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      addDebugLog(`Error: ${errorMessage}`);
      setError(`Failed to create auction NFT: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return <WalletPrompt />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-black">Create Auction NFT</h1>
            <button 
              onClick={() => router.push('/auction')}
              className="text-gray-600 hover:text-black transition-colors"
            >
              View Auctions
            </button>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* NFT Details */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-black mb-4">NFT Details</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Token Name *
                </label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                  placeholder="e.g., VIP Concert Pass"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                  placeholder="Describe your NFT..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Image URL
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Event Type
                </label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                >
                  <option value="">Select type...</option>
                  <option value="concert">Concert</option>
                  <option value="conference">Conference</option>
                  <option value="workshop">Workshop</option>
                  <option value="meetup">Meetup</option>
                  <option value="course">Course</option>
                  <option value="exclusive">Exclusive Access</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Event Date
                  </label>
                  <input
                    type="datetime-local"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Capacity
                  </label>
                  <input
                    type="number"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="e.g., Virtual, New York, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Organizer
                </label>
                <input
                  type="text"
                  value={organizer}
                  onChange={(e) => setOrganizer(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder={address || "Your address"}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Benefits & Perks (one per line)
                </label>
                <textarea
                  value={benefits}
                  onChange={(e) => setBenefits(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder={`VIP Access\nMeet & Greet\nExclusive Merchandise\nPriority Seating`}
                />
              </div>
            </div>

            {/* Auction Settings */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-black mb-4">Auction Settings</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Minimum Bid *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.000001"
                    min="0"
                    value={minBid}
                    onChange={(e) => setMinBid(e.target.value)}
                    className="w-full px-4 py-3 pr-20 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="0.1"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400">
                    {coinDenom.replace('u', '').toUpperCase()}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Auction Duration *
                </label>
                <select
                  value={auctionDuration}
                  onChange={(e) => setAuctionDuration(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="1">1 Hour</option>
                  <option value="6">6 Hours</option>
                  <option value="12">12 Hours</option>
                  <option value="24">24 Hours</option>
                  <option value="48">2 Days</option>
                  <option value="72">3 Days</option>
                  <option value="168">1 Week</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Bid Currency
                </label>
                <select
                  value={coinDenom}
                  onChange={(e) => setCoinDenom(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="uandr">ANDR</option>
                  <option value="ujuno">JUNO</option>
                  <option value="ustars">STARS</option>
                </select>
              </div>

              {/* Preview Card */}
              <div className="bg-white/50 rounded-xl p-4 border border-gray-300">
                <h3 className="text-lg font-semibold text-black mb-3">Preview</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Name:</span>
                    <span className="text-black">{tokenName || "Unnamed"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Type:</span>
                    <span className="text-black">{eventType || "Not specified"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Min Bid:</span>
                    <span className="text-black">
                      {minBid || "0"} {coinDenom.replace('u', '').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Duration:</span>
                    <span className="text-black">{auctionDuration} hours</span>
                  </div>
                </div>
              </div>

              {/* Create Button */}
              <button
                onClick={mintAndCreateAuction}
                disabled={loading || !tokenName || !minBid}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-black py-4 px-6 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating Auction..." : "Create Auction NFT"}
              </button>

              <p className="text-slate-400 text-sm text-center">
                This will mint the NFT and immediately start the auction
              </p>
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
