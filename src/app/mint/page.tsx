"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSigningClient } from '../utils/andrClient';
import { setupKeplrChain } from '../utils/keplrChain';
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import WalletPrompt from '../components/WalletPrompt';
import NetworkStatus from '../components/NetworkStatus';
import DebugPanel from '../components/DebugPanel';
import MarketplaceViewer from '../components/MarketplaceViewer';
import { useWallet } from '../hooks/useWallet';
import ENV from '../utils/env';

// Contract addresses from environment
const cw721 = ENV.CW721_ADDRESS;
const marketplace = ENV.MARKETPLACE_ADDRESS;

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

  // Generate a unique token ID when component mounts
  useEffect(() => {
    if (!tokenId) {
      const uniqueId = `nft-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      setTokenId(uniqueId);
    }
  }, []);

  // Helper function to populate with sample data for testing
  const populateSampleData = () => {
    setName("Sample NFT");
    setDescription("This is a sample NFT created for testing purposes");
    setImageUrl("https://via.placeholder.com/400x400/0066cc/ffffff?text=Sample+NFT");
    setPrice("1.0");
    setAttributes([
      { trait_type: "Color", value: "Blue" },
      { trait_type: "Rarity", value: "Common" }
    ]);
  };

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

  const checkMintPermissions = async () => {
    if (!isConnected || typeof window === 'undefined') return;

    try {
      addDebugLog("🔍 Checking mint permissions...");
      const rpc = ENV.CHAIN_RPC;
      const { CosmWasmClient } = await import("@cosmjs/cosmwasm-stargate");
      const client = await CosmWasmClient.connect(rpc);
      
      // Get minter info
      const minter = await client.queryContractSmart(cw721, { minter: {} });
      addDebugLog(`Contract minter: ${minter}`);
      addDebugLog(`Your address: ${address}`);
      
      if (minter !== address) {
        setError(`❌ MINT PERMISSION ERROR: This CW721 contract only allows minting by the minter address: ${minter}. Your address (${address}) does not have mint permissions. You need to either:\n1. Use a different CW721 contract that allows public minting\n2. Contact the contract owner to add you as a minter\n3. Use the minter address to mint NFTs`);
        return false;
      }
      
      addDebugLog("✅ You have mint permissions!");
      return true;
      
    } catch (err) {
      addDebugLog(`Error checking permissions: ${err}`);
      return false;
    }
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

    // Check mint permissions first
    const hasPermissions = await checkMintPermissions();
    if (!hasPermissions) {
      return; // Error already set by checkMintPermissions
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");
      clearDebugLogs();

      const rpc = ENV.CHAIN_RPC;
      
      addDebugLog("Starting MINT-ONLY process...");
      addDebugLog(`Environment: RPC=${rpc}, Chain=${ENV.CHAIN_ID}`);
      
      addDebugLog("Setting up Keplr chain...");
      const offlineSigner = await setupKeplrChain();
      
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
            token_uri: JSON.stringify(metadata),
            extension: {
              publisher: address
            }
          }
        },
        "auto" // Use auto gas estimation instead of manual fees
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

    // Check mint permissions first
    const hasPermissions = await checkMintPermissions();
    if (!hasPermissions) {
      return; // Error already set by checkMintPermissions
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");
      clearDebugLogs();

      const rpc = ENV.CHAIN_RPC;
      
      console.log("Environment check:", { rpc, chainId: ENV.CHAIN_ID, cw721, marketplace });
      addDebugLog(`Environment check: RPC=${rpc}, Chain=${ENV.CHAIN_ID}`);
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

      console.log("Setting up Keplr chain...");
      addDebugLog("Setting up Keplr chain...");
      const offlineSigner = await setupKeplrChain();
      
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

      // Step 1: Mint the NFT
      console.log("Attempting to mint NFT...");
      addDebugLog("🎯 Starting NFT mint process...");
      
      addDebugLog("Using Andromeda ADO CW721 mint format with extension...");
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
        "auto" // Use auto gas estimation
      );

      console.log("NFT minted successfully:", mintResult);
      addDebugLog("✅ NFT minted successfully!");
      
      // Wait a moment for the transaction to be processed
      addDebugLog("Waiting for mint transaction to be processed...");
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 2: List the NFT for sale on the marketplace using send_nft
      console.log("Listing NFT for sale...");
      addDebugLog("🏪 Listing NFT on marketplace using send_nft...");
      const priceInMicroAndr = (parseFloat(price) * 1_000_000).toString();
      addDebugLog(`Price: ${price} ANDR = ${priceInMicroAndr} uandr`);
      
      // Prepare the marketplace message according to Andromeda documentation
      const marketplaceMsg = {
        start_sale: {
          price: priceInMicroAndr,
          coin_denom: {
            native_token: "uandr"
          },
          recipient: {
            address: address  // Seller's address to receive proceeds
          }
        }
      };
      
      // Encode the message as base64
      const encodedMsg = btoa(JSON.stringify(marketplaceMsg));
      addDebugLog(`Marketplace message: ${JSON.stringify(marketplaceMsg)}`);
      addDebugLog(`Encoded message: ${encodedMsg}`);
      
      // Send the NFT to the marketplace with the encoded message
      addDebugLog("Sending NFT to marketplace...");
      const listResult = await signingClient.execute(
        address,
        cw721,
        {
          send_nft: {
            contract: marketplace,
            token_id: tokenId,
            msg: encodedMsg
          }
        },
        "auto"
      );

      console.log("NFT sent to marketplace:", listResult);
      addDebugLog("✅ NFT successfully sent to marketplace!");
      
      // Wait a moment for the listing to be processed, then verify
      addDebugLog("Waiting for listing transaction to be processed...");
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify the NFT listing on marketplace
      const isListed = await verifyMarketplaceListing(tokenId, signingClient);
      if (isListed) {
        addDebugLog("🎉 NFT successfully minted and listed!");
        setSuccess(`NFT "${name}" minted and listed successfully! Token ID: ${tokenId}`);
      } else {
        addDebugLog("⚠️ NFT minting succeeded, but listing verification failed.");
        setSuccess(`NFT "${name}" minted successfully! Token ID: ${tokenId}. Listing verification failed - please check marketplace manually.`);
      }
      
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

  const verifyMarketplaceListing = async (tokenId: string, signingClient: SigningCosmWasmClient) => {
    try {
      addDebugLog("🔍 Verifying NFT listing on marketplace...");
      
      // Try multiple verification approaches
      
      // Approach 1: Query sale_ids for this specific token
      try {
        const saleIds = await signingClient.queryContractSmart(marketplace, {
          sale_ids: {
            token_address: cw721,
            token_id: tokenId
          }
        });
        
        if (saleIds.sale_ids && saleIds.sale_ids.length > 0) {
          addDebugLog(`✅ NFT is listed with sale ID: ${saleIds.sale_ids[0]}`);
          
          // Get the sale state details
          const saleState = await signingClient.queryContractSmart(marketplace, {
            sale_state: { sale_id: saleIds.sale_ids[0] }
          });
          
          addDebugLog(`Sale details: Price=${saleState.price} ${saleState.coin_denom}, Status=${saleState.status}`);
          return true;
        }
      } catch (err) {
        addDebugLog(`Could not query sale_ids: ${err instanceof Error ? err.message : String(err)}`);
      }
      
      // Approach 2: Query latest sale state for this token
      try {
        const latestSale = await signingClient.queryContractSmart(marketplace, {
          latest_sale_state: {
            token_address: cw721,
            token_id: tokenId
          }
        });
        
        addDebugLog(`✅ Found latest sale: Price=${latestSale.price}, Status=${latestSale.status}`);
        return true;
      } catch (err) {
        addDebugLog(`Could not query latest_sale_state: ${err instanceof Error ? err.message : String(err)}`);
      }
      
      // Approach 3: Check if we can find the sale in sale_infos_for_address
      try {
        const saleInfos = await signingClient.queryContractSmart(marketplace, {
          sale_infos_for_address: {
            token_address: cw721,
            start_after: null,
            limit: 50
          }
        });
        
        const foundSale = saleInfos.find((info: Record<string, unknown>) => 
          info.sale_ids && Array.isArray(info.sale_ids) && info.sale_ids.length > 0
        );
        
        if (foundSale) {
          addDebugLog(`✅ Found sale in sale_infos_for_address`);
          return true;
        }
      } catch (err) {
        addDebugLog(`Could not query sale_infos_for_address: ${err instanceof Error ? err.message : String(err)}`);
      }
      
      addDebugLog("⚠️ Could not verify NFT listing - it may take a moment to appear");
      return false;
      
    } catch (err) {
      addDebugLog(`❌ Error during verification: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  };

  return (
    <div className="py-8 sm:py-12 lg:py-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8 lg:p-12">
          <div className="mb-8 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-black mb-4">Create Your NFT</h1>
            <p className="text-gray-600 text-base sm:text-lg">Fill in the details below to mint your NFT and list it on the marketplace</p>
            <button
              type="button"
              onClick={populateSampleData}
              className="mt-4 text-sm text-black hover:underline font-medium"
            >
              📝 Fill with sample data for testing
            </button>
          </div>

          {/* Network Status */}
          <div className="mb-4">
            <NetworkStatus rpcUrl={ENV.CHAIN_RPC} />
          </div>

          {/* Contract Status Warning */}
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h3 className="font-medium text-amber-900 mb-2">⚠️ Contract Permissions Notice</h3>
            <p className="text-amber-800 text-sm mb-2">
              This CW721 contract has restricted minting permissions. Only the minter address can create new NFTs.
            </p>
            <div className="text-xs text-amber-700 space-y-1">
              <div><strong>Contract:</strong> {cw721}</div>
              <div><strong>Authorized Minter:</strong> andr1jy34d6caqk6ywf7ewcvptdugw3uuu0jkeumfg</div>
              <div><strong>Your Address:</strong> {address || 'Not connected'}</div>
            </div>
            <p className="text-amber-800 text-sm mt-2">
              💡 If you get an "Unauthorized" error, it means your wallet doesn't have mint permissions on this contract.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-gray-50 border border-gray-300 rounded-lg">
              <p className="text-black">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-gray-50 border border-gray-300 rounded-lg">
              <p className="text-black">{success}</p>
            </div>
          )}

          {!isConnected ? (
            <WalletPrompt 
              title="Mint Your NFT"
              message="Connect your Keplr wallet to start minting unique NFTs on the Andromeda blockchain"
            />
          ) : (
            <div>
              <p className="mb-8 text-black font-medium">Connected: {address}</p>
              
              <form className="space-y-8" onSubmit={(e) => { e.preventDefault(); mintNFT(); }}>
                {/* Token ID */}
                <div>
                  <label className="block text-sm font-medium text-black mb-3">
                    Token ID *
                  </label>
                  <input
                    type="text"
                    value={tokenId}
                    onChange={(e) => setTokenId(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-black"
                    placeholder="e.g., my-nft-001"
                    required
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    NFT Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 text-black rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
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
                    className="w-full px-3 py-2 border border-gray-300 text-black rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                    placeholder="Describe your NFT..."
                    required
                  />
                </div>

                {/* Image URL */}
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Image URL *
                  </label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                    placeholder="https://example.com/image.jpg"
                    required
                  />
                  {imageUrl && (
                    <div className="mt-2">
                      <img 
                        src={imageUrl} 
                        alt="Preview" 
                        className="w-32 h-32 object-cover rounded-lg border border-slate-200"
                        onError={() => setError("Invalid image URL")}
                      />
                    </div>
                  )}
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Sale Price (ANDR) *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                    placeholder="10.0"
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    Price in ANDR tokens (required only for &quot;Mint &amp; List&quot; button)
                  </p>
                </div>

                {/* Attributes */}
                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Attributes (Optional)
                  </label>
                  {attributes.map((attr, index) => (
                    <div key={index} className="flex flex-col sm:flex-row gap-2 mb-3 sm:mb-2">
                      <input
                        type="text"
                        value={attr.trait_type}
                        onChange={(e) => updateAttribute(index, 'trait_type', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                        placeholder="Trait type (e.g., Color)"
                      />
                      <input
                        type="text"
                        value={attr.value}
                        onChange={(e) => updateAttribute(index, 'value', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                        placeholder="Value (e.g., Blue)"
                      />
                      <button
                        type="button"
                        onClick={() => removeAttribute(index)}
                        className="w-full sm:w-auto px-3 py-2 text-black hover:bg-gray-100 rounded-lg text-sm font-medium border border-gray-300"
                        disabled={attributes.length === 1}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addAttribute}
                    className="text-black hover:text-gray-700 text-sm"
                  >
                    + Add Attribute
                  </button>
                </div>

                {/* Submit Buttons */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-black mb-2">💡 Transaction Tips:</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• &quot;Mint NFT Only&quot; requires 1 Keplr transaction approval (safe to test)</li>
                    <li>• &quot;Mint &amp; List NFT&quot; requires 2 Keplr transaction approvals (mint → send_nft to marketplace)</li>
                    <li>• Try &quot;Mint NFT Only&quot; first to test if minting works</li>
                    <li>• Each transaction window will appear sequentially - approve them all</li>
                  </ul>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
                  <button
                    type="button"
                    onClick={mintNFTOnly}
                    disabled={loading}
                    className="w-full sm:flex-1 px-6 sm:px-8 py-3 sm:py-4 bg-white border border-black text-black rounded-lg hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {loading ? "Minting..." : "Mint NFT Only"}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:flex-1 px-6 sm:px-8 py-3 sm:py-4 bg-black text-white rounded-lg hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {loading ? "Minting & Listing..." : "Mint & List NFT"}
                  </button>
                </div>
              </form>

              {/* Permission Check Button */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={checkMintPermissions}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  🔍 Check My Mint Permissions
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Marketplace Viewer */}
      <MarketplaceViewer 
        rpcUrl={process.env.NEXT_PUBLIC_CHAIN_RPC!}
        marketplaceAddress={marketplace}
        cw721Address={cw721}
      />
      
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
