'use client'
import { useEffect, useState } from "react";
import { getQueryClient, getSigningClient } from "./utils/andrClient";
import NFTCard from "./components/NFTcard";

const cw721 = process.env.NEXT_PUBLIC_CW721_ADDRESS!;
const marketplace = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS!;
const rpc = process.env.NEXT_PUBLIC_CHAIN_RPC!;
const rest = process.env.NEXT_PUBLIC_CHAIN_REST!;
const chainId = process.env.NEXT_PUBLIC_CHAIN_ID!;

export default function Home() {
  const [wallet, setWallet] = useState<any>(null);
  const [address, setAddress] = useState<string>("");
  const [nfts, setNFTs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Check if environment variables are set
  useEffect(() => {
    if (!cw721 || !marketplace || !rpc || !rest || !chainId) {
      setError("Missing environment variables. Please check your .env.local file.");
    }
  }, []);

  const connectWallet = async () => {
    if (!(window as any).keplr) return alert("Install Keplr!");

    await (window as any).keplr.experimentalSuggestChain({
      chainId,
      chainName: "Andromeda Testnet",
      rpc,
      rest,
      bip44: { coinType: 118 },
      bech32Config: {
        bech32PrefixAccAddr: "andr",
        bech32PrefixAccPub: "andrpub",
        bech32PrefixValAddr: "andrvaloper",
        bech32PrefixValPub: "andrvaloperpub",
        bech32PrefixConsAddr: "andrvalcons",
        bech32PrefixConsPub: "andrvalconspub",
      },
      currencies: [
        {
          coinDenom: "ANDR",
          coinMinimalDenom: "uandr",
          coinDecimals: 6,
        },
      ],
      feeCurrencies: [
        {
          coinDenom: "ANDR",
          coinMinimalDenom: "uandr",
          coinDecimals: 6,
        },
      ],
      stakeCurrency: {
        coinDenom: "ANDR",
        coinMinimalDenom: "uandr",
        coinDecimals: 6,
      },
      features: ["stargate", "ibc-transfer"],
    });

    await (window as any).keplr.enable(chainId);
    const offlineSigner = (window as any).keplr.getOfflineSigner(chainId);
    const accounts = await offlineSigner.getAccounts();
    setWallet(offlineSigner);
    setAddress(accounts[0].address);
  };

  const fetchNFTs = async () => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    try {
      setLoading(true);
      setError("");
      
      const client = await getQueryClient(rpc);

      // Get all sales for our CW721 contract using sale_infos_for_address
      console.log('Querying marketplace for sales...');
      const saleInfosResponse = await client.queryContractSmart(marketplace, {
        sale_infos_for_address: { 
          token_address: cw721,
          start_after: null,
          limit: 50 // Get up to 50 sales
        }
      });
      
      console.log('Sale infos response:', saleInfosResponse);
      
      if (!saleInfosResponse || saleInfosResponse.length === 0) {
        console.log('No sales found');
        setNFTs([]);
        return;
      }

      // Fetch detailed sale state for each sale
      const salesPromises = saleInfosResponse.flatMap((info: any) => 
        info.sale_ids.map(async (saleId: string) => {
          try {
            const saleState = await client.queryContractSmart(marketplace, {
              sale_state: { sale_id: saleId }
            });
            
            return {
              saleId,
              tokenId: info.token_id,
              tokenAddress: info.token_address,
              price: saleState.price,
              status: saleState.status,
              seller: saleState.recipient?.address,
              coinDenom: saleState.coin_denom,
              isSold: saleState.status === 'executed',
              startTime: saleState.start_time,
              endTime: saleState.end_time,
              ...saleState
            };
          } catch (error) {
            console.error(`Error fetching sale ${saleId}:`, error);
            return null;
          }
        })
      );

      const salesResults = await Promise.all(salesPromises);
      const validSales = salesResults.filter(sale => sale !== null);
      
      console.log('Valid sales:', validSales);
      setNFTs(validSales);

    } catch (err) {
      console.error("Error fetching NFTs:", err);
      setError("Failed to fetch NFTs. Please check your connection and contract addresses.");
    } finally {
      setLoading(false);
    }
  };

  const buyNFT = async (saleId: string, price: string) => {
    if (!wallet || !address || typeof window === 'undefined') return;

    try {
      setLoading(true);
      setError("");

      const signingClient = await getSigningClient(rpc, wallet);

      const result = await signingClient.execute(
        address,
        marketplace,
        {
          buy: {
            sale_id: saleId,
          },
        },
        "auto",
        undefined,
        [{ amount: price, denom: "uandr" }]
      );

      console.log("Bought NFT!", result);
      alert("Bought successfully!");
      fetchNFTs(); // refresh
    } catch (err) {
      console.error("Error buying NFT:", err);
      setError("Failed to buy NFT. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined' && !error && cw721 && marketplace && rpc && rest && chainId) {
      fetchNFTs();
    }
  }, []);

  return (
    <div className="p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🧠 Your NFT Marketplace</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {!address ? (
        <button 
          onClick={connectWallet}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
          disabled={loading}
        >
          Connect Wallet
        </button>
      ) : (
        <p className="text-green-600 font-medium">Connected: {address}</p>
      )}

      <div className="mt-8">
        {loading ? (
          <p className="text-blue-500">Loading...</p>
        ) : nfts.length === 0 ? (
          <p className="text-gray-500">No NFTs found.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {nfts.map((nft) => (
              <NFTCard
                key={nft.saleId}
                saleId={nft.saleId}
                tokenId={nft.tokenId}
                price={nft.price}
                seller={nft.seller}
                status={nft.status}
                coinDenom={nft.coinDenom}
                isSold={nft.isSold}
                onBuy={() => buyNFT(nft.saleId, nft.price)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}