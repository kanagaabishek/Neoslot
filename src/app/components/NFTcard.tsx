// components/NFTCard.tsx
'use client'
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface NFTCardProps {
  saleId: string;
  tokenId: string;
  price: string;
  seller: string;
  status: string;
  coinDenom: string;
  isSold: boolean;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
  } | null;
  onBuy: () => void;
}

const NFTCard: React.FC<NFTCardProps> = ({ 
  saleId, 
  tokenId, 
  price, 
  seller, 
  status,
  coinDenom,
  isSold,
  metadata,
  onBuy 
}) => {
  const router = useRouter();

  // Debug: Log metadata to console
  useEffect(() => {
    console.log(`NFTCard ${tokenId} metadata:`, metadata);
    if (metadata) {
      console.log(`- Has name: ${!!metadata.name}`);
      console.log(`- Has description: ${!!metadata.description}`);
      console.log(`- Has image: ${!!metadata.image}`);
    }
  }, [tokenId, metadata]);

  const formatPrice = (price: string, denom: string) => {
    // Convert microandr to andr (divide by 1,000,000)
    if (denom === 'uandr') {
      const andrAmount = (parseInt(price) / 1_000_000).toString();
      return `${andrAmount} ANDR`;
    }
    return `${price} ${denom}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'executed': return 'text-gray-600';
      case 'open': return 'text-black';
      default: return 'text-gray-600';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'executed': return 'Sold';
      case 'open': return 'Available';
      default: return status;
    }
  };

  const handleCardClick = () => {
    router.push(`/nft/${tokenId}`);
  };

  const handleBuyClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click when buying
    onBuy();
  };

  return (
    <div 
      className="border border-gray-200 rounded-xl p-4 sm:p-6 lg:p-8 bg-white mb-6 cursor-pointer hover:shadow-lg transition-all duration-200"
      onClick={handleCardClick}
    >
      {/* NFT Image or Placeholder */}
      <div className="w-full h-48 sm:h-56 bg-gray-100 rounded-lg mb-4 sm:mb-6 flex items-center justify-center overflow-hidden">
        {metadata?.image ? (
          <img 
            src={metadata.image} 
            alt={metadata.name || `NFT #${tokenId}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              // If image fails to load, show placeholder
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={`text-center text-gray-500 ${metadata?.image ? 'hidden' : ''}`}>
          <svg className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2 sm:mb-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
          <p className="text-xs sm:text-sm font-medium">
            {metadata?.name ? metadata.name : `NFT #${tokenId}`}
          </p>
        </div>
      </div>

      {/* NFT Name - Highlighted */}
      {metadata?.name ? (
        <div className="mb-3 sm:mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-black mb-1 leading-tight">
            {metadata.name}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500">Token ID: #{tokenId}</p>
        </div>
      ) : (
        <div className="mb-3 sm:mb-4">
          <h2 className="text-lg sm:text-xl font-bold mb-1 text-black">NFT #{tokenId}</h2>
          {metadata === null ? (
            <p className="text-xs sm:text-sm text-gray-400">Loading metadata...</p>
          ) : (
            <p className="text-xs sm:text-sm text-gray-500">No name available</p>
          )}
        </div>
      )}

      {/* Description if available */}
      {metadata?.description && (
        <p className="mb-3 text-sm text-gray-600 line-clamp-2">
          {metadata.description}
        </p>
      )}

      <p className="mb-2 text-xs sm:text-sm text-gray-500">Sale ID: {saleId}</p>
      <p className="mb-2 sm:mb-3 font-bold text-black text-base sm:text-lg">Price: {formatPrice(price, coinDenom)}</p>
      <p className="mb-2 sm:mb-3 text-xs sm:text-sm text-gray-600">
        Seller: {seller?.slice(0, 8)}...{seller?.slice(-4)}
      </p>
      <p className={`mb-4 sm:mb-6 text-xs sm:text-sm font-medium ${getStatusColor(status)}`}>
        Status: {getStatusText(status)}
      </p>
      
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <button
          onClick={handleCardClick}
          className="w-full sm:flex-1 px-4 sm:px-6 py-2 sm:py-3 bg-white border border-black text-black rounded-lg hover:bg-gray-50 transition-all duration-200 text-xs sm:text-sm font-medium"
        >
          View Details
        </button>
        
        {status === 'open' && !isSold && (
          <button
            onClick={handleBuyClick}
            className="w-full sm:flex-1 px-4 sm:px-6 py-2 sm:py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-all duration-200 text-xs sm:text-sm font-medium"
          >
            Buy Now
          </button>
        )}
        
        {status === 'executed' && (
          <div className="w-full sm:flex-1 px-4 sm:px-6 py-2 sm:py-3 bg-gray-100 text-gray-600 rounded-lg text-center text-xs sm:text-sm font-medium">
            Sold
          </div>
        )}
      </div>
    </div>
  );
};

export default NFTCard;
