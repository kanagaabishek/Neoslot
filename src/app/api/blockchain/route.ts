// Server-side API route to handle ALL blockchain queries
// This bypasses browser CORS and mixed content issues completely

import { NextRequest, NextResponse } from 'next/server';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_CHAIN_RPC || "http://137.184.182.11:26657";
const FALLBACK_RPC = process.env.NEXT_PUBLIC_FALLBACK_RPC || "http://137.184.182.11:26657";
const CW721_ADDRESS = process.env.NEXT_PUBLIC_CW721_ADDRESS || "andr1tkjswumejtgqd9f0atw8ve0qlfswrmn2202wv45gp40rt8ch7fvs6e83lu";
const MARKETPLACE_ADDRESS = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS || "andr1pux5demcm9xwcsdwshg6splta5ajrkq26w4tkf636vnaa8k49zxqnxlnfg";
const AUCTION_ADDRESS = process.env.NEXT_PUBLIC_AUCTION_ADDRESS || "andr1j2gwn97plye7h0xh0j2g8e7huwr6f3jqzrln64c7aqwlrg3n2ueq0p0zss";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cosmWasmClient: any = null;

async function getClient() {
  if (!cosmWasmClient) {
    const { CosmWasmClient } = await import("@cosmjs/cosmwasm-stargate");
    
    console.log("Server: Attempting connection to primary RPC:", RPC_URL);
    
    try {
      cosmWasmClient = await CosmWasmClient.connect(RPC_URL);
      console.log("Server: Successfully connected to primary RPC");
    } catch (primaryError) {
      console.warn("Server: Primary RPC failed, trying fallback:", FALLBACK_RPC);
      
      try {
        cosmWasmClient = await CosmWasmClient.connect(FALLBACK_RPC);
        console.log("Server: Successfully connected to fallback RPC");
      } catch (fallbackError) {
        console.error("Server: Both RPC endpoints failed");
        console.error("Primary error:", primaryError);
        console.error("Fallback error:", fallbackError);
        throw new Error(`Failed to connect to blockchain network. Tried endpoints: ${RPC_URL}, ${FALLBACK_RPC}. This may be due to network connectivity issues or RPC endpoints being unavailable.`);
      }
    }
  }
  return cosmWasmClient;
}

export async function POST(request: NextRequest) {
  console.log("Server: Blockchain API endpoint called");
  
  try {
    const { type, params } = await request.json();
    console.log("Server: Request type:", type, "Params:", params);
    
    // Test RPC connectivity first
    console.log("Server: Testing RPC connectivity to:", RPC_URL);
    
    const client = await getClient();
    console.log("Server: Successfully connected to blockchain");
    
    let result;

    switch (type) {
      case 'marketplace_sales':
        console.log("Server: Fetching marketplace sales");
        const salesData = [];
        
        // Try to query sale IDs 1 through 10
        for (let i = 1; i <= 10; i++) {
          try {
            const saleState = await client.queryContractSmart(MARKETPLACE_ADDRESS, {
              sale_state: { sale_id: i.toString() }
            });
            
            console.log(`Server: Found sale ${i}:`, saleState);
            
            // For marketplace sales, we might need to query the marketplace differently
            // Let's add the sale without metadata for now and see what we get
            salesData.push({
              sale_id: i.toString(),
              token_id: `sale_${i}`, // Use sale ID as token ID for now
              ...saleState,
              metadata: null
            });
            
          } catch (err) {
            console.log(`Server: Sale ${i} not found, stopping search`);
            // Sale doesn't exist, break
            break;
          }
        }
        
        console.log(`Server: Found ${salesData.length} marketplace sales`);
        result = { sales: salesData };
        break;

      case 'auction_list':
        console.log("Server: Fetching auction list");
        try {
          const auctionsQuery = { 
            auction_infos_for_address: {
              token_address: CW721_ADDRESS,
              limit: 50
            }
          };
          
          const auctionsResponse = await client.queryContractSmart(AUCTION_ADDRESS, auctionsQuery);
          console.log("Server: Raw auction response:", auctionsResponse);
          
          const auctions = [];
          
          // The response is an array of objects with auction_ids and token_id
          for (const auctionInfo of auctionsResponse || []) {
            const { auction_ids, token_id } = auctionInfo;
            
            // For each auction_id, try to get the auction details
            for (const auctionId of auction_ids || []) {
              try {
                const auctionState = await client.queryContractSmart(AUCTION_ADDRESS, {
                  auction_state: { auction_id: auctionId }
                });
                
                // Get NFT metadata
                let metadata = null;
                try {
                  const nftInfo = await client.queryContractSmart(CW721_ADDRESS, {
                    nft_info: { token_id: token_id }
                  });
                  metadata = nftInfo.extension;
                } catch (metadataError) {
                  console.log(`Server: Failed to get metadata for token ${token_id}`);
                }
                
                auctions.push({
                  auction_id: auctionId,
                  token_id: token_id,
                  ...auctionState,
                  metadata: metadata
                });
                
                console.log(`Server: Added auction ${auctionId} for token ${token_id}`);
                
              } catch (auctionError) {
                const errorMsg = auctionError instanceof Error ? auctionError.message : 'Unknown error';
                console.log(`Server: Failed to get auction ${auctionId} details:`, errorMsg);
              }
            }
          }
          
          console.log(`Server: Found ${auctions.length} auctions`);
          result = { auctions };
          
        } catch (error) {
          console.error("Server: Auction query failed:", error);
          result = { auctions: [] };
        }
        break;

      case 'auction_details':
        console.log("Server: Fetching auction details for:", params?.tokenId);
        if (!params?.tokenId) {
          throw new Error("Token ID is required for auction details");
        }

        // Try multiple methods to find the auction
        let auctionDetails = null;
        
        try {
          // Method 1: Try auction_ids query
          const auctionIdsResponse = await client.queryContractSmart(AUCTION_ADDRESS, {
            auction_ids: { token_id: params.tokenId, token_address: CW721_ADDRESS }
          });
          
          if (auctionIdsResponse.auction_ids && auctionIdsResponse.auction_ids.length > 0) {
            const auctionId = auctionIdsResponse.auction_ids[0];
            auctionDetails = await client.queryContractSmart(AUCTION_ADDRESS, {
              auction_info: { auction_id: auctionId }
            });
          }
        } catch (err) {
          console.log("Server: auction_ids method failed, trying auction_infos_for_address");
        }

        if (!auctionDetails) {
          // Method 2: Search through all auctions
          try {
            const allAuctionsResponse = await client.queryContractSmart(AUCTION_ADDRESS, {
              auction_infos_for_address: { token_address: CW721_ADDRESS, limit: 100 }
            });
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            auctionDetails = allAuctionsResponse.auctions?.find((a: any) => a.token_id === params.tokenId);
          } catch (err) {
            console.log("Server: auction_infos_for_address method also failed");
          }
        }

        if (auctionDetails) {
          // Get NFT metadata
          const nftInfo = await client.queryContractSmart(CW721_ADDRESS, {
            nft_info: { token_id: params.tokenId }
          });
          
          result = {
            auction: {
              ...auctionDetails,
              metadata: nftInfo.extension
            }
          };
        } else {
          result = { error: "No auction found for this token" };
        }
        break;

      case 'nft_info':
        console.log("Server: Fetching NFT info for:", params?.tokenId);
        if (!params?.tokenId) {
          throw new Error("Token ID is required for NFT info");
        }

        const ownerInfo = await client.queryContractSmart(CW721_ADDRESS, {
          owner_of: { token_id: params.tokenId }
        });

        const nftInfo = await client.queryContractSmart(CW721_ADDRESS, {
          nft_info: { token_id: params.tokenId }
        });

        result = {
          owner: ownerInfo.owner,
          metadata: nftInfo.extension,
          token_id: params.tokenId
        };
        break;

      case 'user_nfts':
        console.log("Server: Fetching user NFTs for:", params?.address);
        if (!params?.address) {
          throw new Error("Address is required for user NFTs");
        }

        const tokensResponse = await client.queryContractSmart(CW721_ADDRESS, {
          tokens: { owner: params.address, limit: 100 }
        });

        const userNFTs = [];
        for (const tokenId of tokensResponse.tokens || []) {
          try {
            const nftInfo = await client.queryContractSmart(CW721_ADDRESS, {
              nft_info: { token_id: tokenId }
            });
            
            // Check if there's a sale for this NFT
            let saleInfo = null;
            try {
              const saleIdsResponse = await client.queryContractSmart(MARKETPLACE_ADDRESS, {
                sale_ids: { 
                  token_address: CW721_ADDRESS,
                  token_id: tokenId
                }
              });
              
              if (saleIdsResponse.sale_ids && saleIdsResponse.sale_ids.length > 0) {
                const saleId = saleIdsResponse.sale_ids[0];
                const saleState = await client.queryContractSmart(MARKETPLACE_ADDRESS, {
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
              console.log(`Server: No sale found for NFT ${tokenId} (expected for non-listed NFTs)`);
            }
            
            userNFTs.push({
              token_id: tokenId,
              metadata: nftInfo.extension,
              saleInfo
            });
          } catch (err) {
            // Skip this NFT if metadata fetch fails
            console.warn(`Server: Failed to fetch metadata for token ${tokenId}`);
          }
        }

        result = { nfts: userNFTs };
        break;

      case 'nft_details':
        console.log("Server: Fetching NFT details for:", params?.tokenId);
        if (!params?.tokenId) {
          throw new Error("Token ID is required for NFT details");
        }

        // Get owner info
        const ownerDetails = await client.queryContractSmart(CW721_ADDRESS, {
          owner_of: { token_id: params.tokenId }
        });

        // Get token info (metadata)
        const tokenDetails = await client.queryContractSmart(CW721_ADDRESS, {
          nft_info: { token_id: params.tokenId }
        });

        let metadata = {};
        
        // Parse metadata from token_uri or extension
        if (tokenDetails.token_uri) {
          try {
            metadata = JSON.parse(tokenDetails.token_uri);
          } catch {
            // If parsing fails, treat as plain string
            metadata = { name: tokenDetails.token_uri };
          }
        }
        
        if (tokenDetails.extension) {
          metadata = { ...metadata, ...tokenDetails.extension };
        }

        // Check if there's a sale for this NFT
        let saleInfo = null;
        try {
          const saleIdsResponse = await client.queryContractSmart(MARKETPLACE_ADDRESS, {
            sale_ids: { 
              token_address: CW721_ADDRESS,
              token_id: params.tokenId
            }
          });
          
          if (saleIdsResponse.sale_ids && saleIdsResponse.sale_ids.length > 0) {
            const saleId = saleIdsResponse.sale_ids[0];
            const saleState = await client.queryContractSmart(MARKETPLACE_ADDRESS, {
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
          console.log("Server: No sale found for this NFT (expected for non-listed NFTs)");
        }

        result = {
          owner: ownerDetails.owner,
          metadata,
          tokenUri: tokenDetails.token_uri,
          saleInfo: saleInfo || undefined
        };
        break;

      default:
        throw new Error(`Unknown request type: ${type}`);
    }

    console.log("Server: Request completed successfully");
    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    console.error("Server: Request failed:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown server error"
      },
      { status: 500 }
    );
  }
}
