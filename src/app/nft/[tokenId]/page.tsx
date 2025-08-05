"use client"

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getQueryClient, getSigningClient } from '../../utils/andrClient';
import { useWallet } from '../../hooks/useWallet';

// Environment variables
const cw721 = process.env.NEXT_PUBLIC_CW721_ADDRESS!;
const marketplace = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS!;

interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{
    trait_type: string;
    value: string;
  }>;
}

interface NFTDetails {
  tokenId: string;
  owner: string;
  metadata?: NFTMetadata;
  tokenUri?: string;
  saleInfo?: {
    saleId: string;
    price: string;
    status: string;
    seller: string;
    coinDenom: string;
  };
}

export default function NFTDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tokenId = params.tokenId as string;
  const { address, isConnected, connectWallet } = useWallet();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nftDetails, setNftDetails] = useState<NFTDetails | null>(null);

  const fetchNFTDetails = async () => {
    if (typeof window === 'undefined') return;
    
    try {
      setLoading(true);
      setError("");
      
      const rpc = process.env.NEXT_PUBLIC_CHAIN_RPC!;
      const client = await getQueryClient(rpc);

      // Get NFT info from CW721 contract
      console.log('Fetching NFT details for token:', tokenId);
      
      // Get owner
      const ownerInfo = await client.queryContractSmart(cw721, {
        owner_of: { token_id: tokenId }
      });

      // Get token info (metadata)
      const tokenInfo = await client.queryContractSmart(cw721, {
        nft_info: { token_id: tokenId }
      });

      let metadata: NFTMetadata = {};
      
      // Parse metadata from token_uri or extension
      if (tokenInfo.token_uri) {
        try {
          metadata = JSON.parse(tokenInfo.token_uri);
        } catch {
          // If parsing fails, treat as plain string
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
          } as {
            saleId: string;
            price: string;
            status: string;
            seller: string;
            coinDenom: string;
          };
        }
      } catch (saleError) {
        console.log('No sale found for this NFT or error fetching sale:', saleError);
      }

      setNftDetails({
        tokenId,
        owner: ownerInfo.owner,
        metadata,
        tokenUri: tokenInfo.token_uri,
        saleInfo: saleInfo || undefined
      });

    } catch (err) {
      console.error("Error fetching NFT details:", err);
      setError("Failed to fetch NFT details. Please check if the token ID exists.");
    } finally {
      setLoading(false);
    }
  };

  const buyNFT = async () => {
    if (!isConnected || !address || !nftDetails?.saleInfo) return;

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
            sale_id: nftDetails.saleInfo.saleId,
          },
        },
        "auto",
        undefined,
        [{ amount: nftDetails.saleInfo.price, denom: nftDetails.saleInfo.coinDenom }]
      );

      console.log("Bought NFT!", result);
      alert("NFT purchased successfully!");
      
      // Refresh NFT details
      fetchNFTDetails();
      
    } catch (err) {
      console.error("Error buying NFT:", err);
      setError("Failed to buy NFT. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tokenId) {
      fetchNFTDetails();
    }
  }, [tokenId]);

  const formatPrice = (price: string, denom: string) => {
    if (denom === 'uandr') {
      const andrAmount = (parseInt(price) / 1_000_000).toString();
      return `${andrAmount} ANDR`;
    }
    return `${price} ${denom}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'executed': return 'text-red-600 bg-red-50';
      case 'open': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'executed': return 'Sold';
      case 'open': return 'For Sale';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading NFT details...</p>
        </div>
      </div>
    );
  }

  if (error || !nftDetails) {
    return (
      <div className="py-20 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">NFT Not Found</h1>
            <p className="text-gray-600 mb-6">{error || "The requested NFT could not be found."}</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Back to Marketplace
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden px-3">
          <div className="md:flex">
            {/* Image Section */}
            <div className="md:w-1/2">
              <div className="aspect-square">
                {nftDetails.metadata?.image ? (
                  <img
                    src={nftDetails.metadata.image}
                    alt={nftDetails.metadata.name || `NFT ${tokenId}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <svg className="w-16 h-16 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                      </svg>
                      <p>No Image Available</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Details Section */}
            <div className="md:w-1/2 p-6">
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {nftDetails.metadata?.name || `NFT #${tokenId}`}
                </h1>
                <p className="text-lg text-gray-600">Token ID: {tokenId}</p>
              </div>

              {/* Owner Info */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Owner</h3>
                <p className="text-sm font-mono bg-gray-100 p-2 rounded">
                  {nftDetails.owner}
                </p>
              </div>

              {/* Sale Info */}
              {nftDetails.saleInfo && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Sale Details</h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(nftDetails.saleInfo.status)}`}>
                      {getStatusText(nftDetails.saleInfo.status)}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-600">Price: </span>
                      <span className="text-xl font-bold text-gray-900">
                        {formatPrice(nftDetails.saleInfo.price, nftDetails.saleInfo.coinDenom)}
                      </span>
                    </div>
                    
                    <div>
                      <span className="text-sm text-gray-600">Sale ID: </span>
                      <span className="font-mono text-sm">{nftDetails.saleInfo.saleId}</span>
                    </div>

                    {nftDetails.saleInfo.seller && (
                      <div>
                        <span className="text-sm text-gray-600">Seller: </span>
                        <span className="font-mono text-sm">
                          {nftDetails.saleInfo.seller.slice(0, 10)}...{nftDetails.saleInfo.seller.slice(-6)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Buy Button */}
                  {nftDetails.saleInfo.status === 'open' && (
                    <div className="mt-6">
                      {!address ? (
                        <button
                          onClick={connectWallet}
                          className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                          Connect Wallet to Buy
                        </button>
                      ) : (
                        <button
                          onClick={buyNFT}
                          disabled={loading}
                          className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                        >
                          {loading ? "Processing..." : `Buy for ${formatPrice(nftDetails.saleInfo.price, nftDetails.saleInfo.coinDenom)}`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              {nftDetails.metadata?.description && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                  <p className="text-gray-700 leading-relaxed">
                    {nftDetails.metadata.description}
                  </p>
                </div>
              )}

              {/* Attributes */}
              {nftDetails.metadata?.attributes && nftDetails.metadata.attributes.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Attributes</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {nftDetails.metadata.attributes.map((attr, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm text-gray-600 font-medium">{attr.trait_type}</div>
                        <div className="text-gray-900 font-semibold">{attr.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw Metadata */}
              {nftDetails.tokenUri && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Technical Details</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Token URI</h4>
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all">
                      {nftDetails.tokenUri}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
