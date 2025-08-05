"use client"

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSigningClient } from '../utils/andrClient';
import WalletPrompt from '../components/WalletPrompt';
import NetworkStatus from '../components/NetworkStatus';
import DebugPanel from '../components/DebugPanel';
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
  
  // Debug panel states
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  
  const addDebugLog = (message: string) => {
    setDebugLogs(prev => [...prev, message]);
    console.log("DEBUG:", message);
  };
  
  const clearDebugLogs = () => {
    setDebugLogs([]);
  };
  
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

  const mintNFTOnly = async () => {
    if (!isConnected || typeof window === 'undefined') {
      setError("Please connect your wallet first");
      return;
    }

    if (!tokenId || !name || !description || !imageUrl) {
      setError("Please fill in all required fields except price (not needed for mint-only)");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");
      clearDebugLogs();

      const rpc = process.env.NEXT_PUBLIC_CHAIN_RPC!;
      const chainId = process.env.NEXT_PUBLIC_CHAIN_ID!;
      
      addDebugLog("Starting MINT-ONLY process...");
      addDebugLog(`Environment: RPC=${rpc}, Chain=${chainId}`);
      
      // Get wallet signer
      if (!window.keplr) {
        throw new Error("Keplr wallet not found. Please install Keplr extension.");
      }

      addDebugLog("Enabling Keplr wallet...");
      await window.keplr.enable(chainId);
      const offlineSigner = window.keplr.getOfflineSigner(chainId);
      
      addDebugLog("Creating signing client...");
      const signingClient = await getSigningClient(rpc, offlineSigner);

      // Prepare metadata
      const metadata: NFTMetadata = {
        name,
        description,
        image: imageUrl,
        attributes: attributes.filter(attr => attr.trait_type && attr.value)
      };

      addDebugLog("Prepared metadata: " + JSON.stringify(metadata));

      // Mint the NFT only
      addDebugLog("🎯 Minting NFT (without marketplace listing)...");
      const mintResult = await signingClient.execute(
        address,
        cw721,
        {
          mint: {
            token_id: tokenId,
            owner: address,
            token_uri: JSON.stringify(metadata)
          }
        },
        {
          amount: [{ denom: "uandr", amount: "1000000" }],
          gas: "500000"
        }
      );

      console.log("NFT minted successfully:", mintResult);
      addDebugLog("✅ NFT minted successfully!");
      setSuccess(`NFT "${name}" minted successfully! Token ID: ${tokenId}`);
      
      // Reset form
      setTokenId("");
      setName("");
      setDescription("");
      setImageUrl("");
      setAttributes([{ trait_type: "", value: "" }]);

    } catch (err) {
      console.error("Error minting NFT:", err);
      addDebugLog(`💥 Error: ${err instanceof Error ? err.message : String(err)}`);
      setError(`Failed to mint NFT: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
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
      clearDebugLogs();

      const rpc = process.env.NEXT_PUBLIC_CHAIN_RPC!;
      const chainId = process.env.NEXT_PUBLIC_CHAIN_ID!;
      
      console.log("Environment check:", { rpc, chainId, cw721, marketplace });
      addDebugLog(`Environment check: RPC=${rpc}, Chain=${chainId}`);
      addDebugLog(`Contracts: CW721=${cw721}, Marketplace=${marketplace}`);
      
      // Check network connectivity first
      try {
        addDebugLog("Testing RPC connectivity...");
        const response = await fetch(rpc + "/status");
        if (!response.ok) {
          throw new Error(`RPC endpoint ${rpc} is not responding`);
        }
        console.log("RPC endpoint is reachable");
        addDebugLog("✅ RPC endpoint is reachable");
      } catch (networkErr) {
        addDebugLog(`❌ Network error: ${networkErr}`);
        throw new Error(`Network error: Cannot reach RPC endpoint ${rpc}. Please check your internet connection.`);
      }

      // Get wallet signer
      if (!window.keplr) {
        throw new Error("Keplr wallet not found. Please install Keplr extension.");
      }

      console.log("Enabling Keplr for chain:", chainId);
      addDebugLog("Enabling Keplr wallet...");
      await window.keplr.enable(chainId);
      const offlineSigner = window.keplr.getOfflineSigner(chainId);
      
      console.log("Getting signing client...");
      addDebugLog("Creating signing client...");
      const signingClient = await getSigningClient(rpc, offlineSigner);

      // Verify the current account
      const accounts = await offlineSigner.getAccounts();
      console.log("Connected accounts:", accounts);
      addDebugLog(`Connected accounts: ${accounts.length} found`);
      
      if (accounts.length === 0) {
        throw new Error("No accounts found in wallet");
      }

      // Check if we can query the blockchain
      try {
        const balance = await signingClient.getBalance(address, "uandr");
        console.log("Account balance:", balance);
        
        if (parseInt(balance.amount) === 0) {
          throw new Error("Insufficient balance. You need some ANDR tokens to pay for transaction fees.");
        }
      } catch (balanceErr) {
        console.warn("Could not check balance:", balanceErr);
      }

      // Test contract connectivity
      try {
        const contractInfo = await signingClient.queryContractSmart(cw721, { contract_info: {} });
        console.log("CW721 Contract info:", contractInfo);
      } catch (queryErr) {
        console.log("Could not query CW721 contract info:", queryErr);
      }

      // Test marketplace connectivity with correct query
      try {
        const owner = await signingClient.queryContractSmart(marketplace, { owner: {} });
        console.log("Marketplace owner:", owner);
      } catch (queryErr) {
        console.log("Could not query marketplace owner:", queryErr);
        // Try to get marketplace type
        try {
          const marketplaceType = await signingClient.queryContractSmart(marketplace, { type: {} });
          console.log("Marketplace type:", marketplaceType);
        } catch (typeErr) {
          console.warn("Could not query marketplace type:", typeErr);
        }
      }

      // Prepare metadata
      const metadata: NFTMetadata = {
        name,
        description,
        image: imageUrl,
        attributes: attributes.filter(attr => attr.trait_type && attr.value)
      };

      console.log("Prepared metadata:", metadata);

      // Step 1: Mint the NFT - try different message formats
      console.log("Attempting to mint NFT...");
      addDebugLog("🎯 Starting NFT mint process...");
      let mintResult;
      
      try {
        addDebugLog("Trying standard CW721 mint format...");
        // Try standard CW721 mint format first
        mintResult = await signingClient.execute(
          address,
          cw721,
          {
            mint: {
              token_id: tokenId,
              owner: address,
              token_uri: JSON.stringify(metadata)
            }
          },
          {
            amount: [{ denom: "uandr", amount: "1000000" }], // 1 ANDR gas fee
            gas: "500000"
          }
        );
        addDebugLog("✅ Standard CW721 mint successful!");
      } catch (mintErr1) {
        console.log("First mint format failed, trying Andromeda ADO format:", mintErr1);
        addDebugLog(`❌ Standard format failed: ${mintErr1 instanceof Error ? mintErr1.message : String(mintErr1)}`);
        
        try {
          addDebugLog("Trying Andromeda ADO format with extension...");
          // Try Andromeda ADO format
          mintResult = await signingClient.execute(
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
            {
              amount: [{ denom: "uandr", amount: "1000000" }],
              gas: "500000"
            }
          );
          addDebugLog("✅ Andromeda ADO format successful!");
        } catch (mintErr2) {
          console.log("Second mint format failed, trying without extension:", mintErr2);
          addDebugLog(`❌ ADO format failed: ${mintErr2 instanceof Error ? mintErr2.message : String(mintErr2)}`);
          
          addDebugLog("Trying simplified format without extension...");
          // Try without extension
          mintResult = await signingClient.execute(
            address,
            cw721,
            {
              mint: {
                token_id: tokenId,
                owner: address,
                token_uri: JSON.stringify(metadata)
              }
            },
            {
              amount: [{ denom: "uandr", amount: "1000000" }],
              gas: "500000"
            }
          );
          addDebugLog("✅ Simplified format successful!");
        }
      }

      console.log("NFT minted successfully:", mintResult);

      // Step 2: Approve marketplace to transfer the NFT
      console.log("Approving marketplace...");
      addDebugLog("🔐 Approving marketplace for NFT transfer...");
      const approveResult = await signingClient.execute(
        address,
        cw721,
        {
          approve: {
            spender: marketplace,
            token_id: tokenId
          }
        },
        {
          amount: [{ denom: "uandr", amount: "500000" }],
          gas: "300000"
        }
      );

      console.log("Marketplace approved:", approveResult);
      addDebugLog("✅ Marketplace approval successful!");

      // Step 3: List the NFT for sale on the marketplace
      console.log("Listing NFT for sale...");
      addDebugLog("🏪 Listing NFT on marketplace...");
      const priceInMicroAndr = (parseFloat(price) * 1_000_000).toString();
      addDebugLog(`Price: ${price} ANDR = ${priceInMicroAndr} uandr`);
      
      // Try Andromeda marketplace format
      let listResult;
      try {
        addDebugLog("Trying start_sale format...");
        listResult = await signingClient.execute(
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
              start_time: { at_time: (Date.now() * 1000000).toString() },
              duration: null
            }
          },
          {
            amount: [{ denom: "uandr", amount: "500000" }],
            gas: "300000"
          }
        );
        addDebugLog("✅ start_sale format successful!");
      } catch (listErr1) {
        console.log("First marketplace format failed, trying alternative format:", listErr1);
        addDebugLog(`❌ start_sale failed: ${listErr1 instanceof Error ? listErr1.message : String(listErr1)}`);
        
        try {
          addDebugLog("Trying simplified start_sale format...");
          // Try alternative format without duration
          listResult = await signingClient.execute(
            address,
            marketplace,
            {
              start_sale: {
                token_id: tokenId,
                token_address: cw721,
                price: {
                  amount: priceInMicroAndr,
                  denom: "uandr"
                }
              }
            },
            {
              amount: [{ denom: "uandr", amount: "500000" }],
              gas: "300000"
            }
          );
          addDebugLog("✅ Simplified start_sale successful!");
        } catch (listErr2) {
          console.log("Second marketplace format failed, trying simple format:", listErr2);
          addDebugLog(`❌ Simplified start_sale failed: ${listErr2 instanceof Error ? listErr2.message : String(listErr2)}`);
          
          addDebugLog("Trying list_nft format...");
          // Try even simpler format
          listResult = await signingClient.execute(
            address,
            marketplace,
            {
              list_nft: {
                token_id: tokenId,
                contract_address: cw721,
                price: priceInMicroAndr,
                denom: "uandr"
              }
            },
            {
              amount: [{ denom: "uandr", amount: "500000" }],
              gas: "300000"
            }
          );
          addDebugLog("✅ list_nft format successful!");
        }
      }

      console.log("NFT listed for sale:", listResult);
      addDebugLog("🎉 NFT successfully minted and listed!");
      setSuccess(`NFT "${name}" minted and listed successfully! Token ID: ${tokenId}`);
      
      // Reset form
      setTokenId("");
      setName("");
      setDescription("");
      setImageUrl("");
      setPrice("");
      setAttributes([{ trait_type: "", value: "" }]);

    } catch (err) {
      console.error("Detailed error minting NFT:", err);
      addDebugLog(`💥 Error occurred: ${err instanceof Error ? err.message : String(err)}`);
      
      let errorMessage = "Failed to mint NFT: ";
      if (err instanceof Error) {
        errorMessage += err.message;
        
        // Provide more specific error messages
        if (err.message.includes("fetch")) {
          errorMessage += "\n\nThis appears to be a network connectivity issue. Please check:\n1. Your internet connection\n2. The RPC endpoint status\n3. Try refreshing the page";
        } else if (err.message.includes("insufficient funds")) {
          errorMessage += "\n\nPlease ensure you have enough ANDR tokens for transaction fees.";
        } else if (err.message.includes("token_id")) {
          errorMessage += "\n\nThe token ID might already exist. Try a different token ID.";
        }
      } else {
        errorMessage += String(err);
      }
      
      addDebugLog(`Error details: ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setLoading(false);
      addDebugLog("Minting process completed.");
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

          {/* Network Status */}
          <div className="mb-4">
            <NetworkStatus rpcUrl={process.env.NEXT_PUBLIC_CHAIN_RPC!} />
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
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Price in ANDR tokens (required only for "Mint & List" button)
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

                {/* Submit Buttons */}
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={mintNFTOnly}
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Minting..." : "Mint NFT Only"}
                  </button>
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
      
      {/* Debug Panel */}
      <DebugPanel 
        logs={debugLogs}
        isVisible={showDebug}
        onToggle={() => setShowDebug(!showDebug)}
        onClear={clearDebugLogs}
      />
    </div>
  );
}
