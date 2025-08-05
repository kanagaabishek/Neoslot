"use client"

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSigningClient } from '../utils/andrClient';
import WalletPrompt from '../components/WalletPrompt';
import { useWallet } from '../hooks/useWallet';

// Environment variables
const cw721 = process.env.NEXT_PUBLIC_CW721_ADDRESS!;
const marketplace = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS!;

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
}

export default function MintPage() {
  const router = useRouter();
  const { address, isConnected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Form states
  const [tokenId, setTokenId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [price, setPrice] = useState("");
  const [attributes, setAttributes] = useState([{ trait_type: "", value: "" }]);

  const addAttribute = () => {
    setAttributes([...attributes, { trait_type: "", value: "" }]);
  };

  const removeAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const updateAttribute = (index: number, field: 'trait_type' | 'value', value: string) => {
    const updated = [...attributes];
    updated[index][field] = value;
    setAttributes(updated);
  };

  const mintNFT = async () => {
    if (!isConnected || typeof window === 'undefined') {
      setError("Please connect your wallet first");
      return;
    }

    if (!tokenId || !name || !description || !imageUrl || !price) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const rpc = process.env.NEXT_PUBLIC_CHAIN_RPC!;
      const chainId = process.env.NEXT_PUBLIC_CHAIN_ID!;
      
      // Get wallet signer
      if (!window.keplr) {
        throw new Error("Keplr wallet not found");
      }

      await window.keplr.enable(chainId);
      const offlineSigner = window.keplr.getOfflineSigner(chainId);
      
      const signingClient = await getSigningClient(rpc, offlineSigner);

      // Let's try to query the contract info first to understand the schema
      try {
        const contractInfo = await signingClient.queryContractSmart(cw721, { contract_info: {} });
        console.log("Contract info:", contractInfo);
      } catch (queryErr) {
        console.log("Could not query contract info:", queryErr);
      }

      // Try querying config
      try {
        const config = await signingClient.queryContractSmart(cw721, { config: {} });
        console.log("Contract config:", config);
      } catch (queryErr) {
        console.log("Could not query config:", queryErr);
      }

      // Prepare metadata
      const metadata: NFTMetadata = {
        name,
        description,
        image: imageUrl,
        attributes: attributes.filter(attr => attr.trait_type && attr.value)
      };

      // Step 1: Mint the NFT using simplified Andromeda ADO format
      console.log("Minting NFT...");
      const mintResult = await signingClient.execute(
        address,
        cw721,
        {
          mint: {
            token_id: tokenId,
            owner: address,
            token_uri: JSON.stringify(metadata),
            extension: {
              publisher: address
            }
          }
        },
        "auto"
      );

      console.log("NFT minted successfully:", mintResult);

      // Step 2: Approve marketplace to transfer the NFT
      console.log("Approving marketplace...");
      const approveResult = await signingClient.execute(
        address,
        cw721,
        {
          approve: {
            spender: marketplace,
            token_id: tokenId
          }
        },
        "auto"
      );

      console.log("Marketplace approved:", approveResult);

      // Step 3: List the NFT for sale on the marketplace
      console.log("Listing NFT for sale...");
      const priceInMicroAndr = (parseFloat(price) * 1_000_000).toString();
      
      const listResult = await signingClient.execute(
        address,
        marketplace,
        {
          start_sale: {
            token_id: tokenId,
            token_address: cw721,
            price: {
              amount: priceInMicroAndr,
              denom: "uandr"
            },
            start_time: { at_time: (Date.now() * 1000000).toString() }, // Current time in nanoseconds
            duration: null // No end time
          }
        },
        "auto"
      );

      console.log("NFT listed for sale:", listResult);
      setSuccess(`NFT "${name}" minted and listed successfully! Token ID: ${tokenId}`);
      
      // Reset form
      setTokenId("");
      setName("");
      setDescription("");
      setImageUrl("");
      setPrice("");
      setAttributes([{ trait_type: "", value: "" }]);

    } catch (err) {
      console.error("Error minting NFT:", err);
      setError(`Failed to mint NFT: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Create Your NFT</h1>
            <p className="text-gray-600 mt-2">Fill in the details below to mint your NFT and list it on the marketplace</p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-600">{success}</p>
            </div>
          )}

          {!isConnected ? (
            <WalletPrompt 
              title="Mint Your NFT"
              message="Connect your Keplr wallet to start minting unique NFTs on the Andromeda blockchain"
            />
          ) : (
            <div>
              <p className="mb-6 text-green-600 font-medium">Connected: {address}</p>
              
              <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); mintNFT(); }}>
                {/* Token ID */}
                <div>
                  <label className="block text-sm text-black font-medium mb-2">
                    Token ID *
                  </label>
                  <input
                    type="text"
                    value={tokenId}
                    onChange={(e) => setTokenId(e.target.value)}
                    className="w-full px-3 py-2 border text-gray-700 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., my-nft-001"
                    required
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NFT Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., My Awesome NFT"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Description *
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Describe your NFT..."
                    required
                  />
                </div>

                {/* Image URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Image URL *
                  </label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://example.com/image.jpg"
                    required
                  />
                  {imageUrl && (
                    <div className="mt-2">
                      <img 
                        src={imageUrl} 
                        alt="Preview" 
                        className="w-32 h-32 object-cover rounded-lg border"
                        onError={() => setError("Invalid image URL")}
                      />
                    </div>
                  )}
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sale Price (ANDR) *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="10.0"
                    required
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Price in ANDR tokens (will be listed for sale immediately)
                  </p>
                </div>

                {/* Attributes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Attributes (Optional)
                  </label>
                  {attributes.map((attr, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={attr.trait_type}
                        onChange={(e) => updateAttribute(index, 'trait_type', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Trait type (e.g., Color)"
                      />
                      <input
                        type="text"
                        value={attr.value}
                        onChange={(e) => updateAttribute(index, 'value', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Value (e.g., Blue)"
                      />
                      <button
                        type="button"
                        onClick={() => removeAttribute(index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                        disabled={attributes.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addAttribute}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    + Add Attribute
                  </button>
                </div>

                {/* Submit Button */}
                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Minting & Listing..." : "Mint & List NFT"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
