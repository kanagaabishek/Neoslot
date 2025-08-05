// components/NFTCard.tsx
'use client'
import React from 'react';
import { useRouter } from 'next/navigation';

interface NFTCardProps {
  saleId: string;
  tokenId: string;
  price: string;
  seller: string;
  status: string;
  coinDenom: string;
  isSold: boolean;
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
  onBuy 
}) => {
  const router = useRouter();

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
      case 'executed': return 'text-red-600';
      case 'open': return 'text-green-600';
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
      className="border rounded-lg p-4 shadow bg-white mb-4 cursor-pointer hover:shadow-lg transition-shadow"
      onClick={handleCardClick}
    >
      {/* Placeholder for NFT image */}
      <div className="w-full h-48 bg-gray-200 rounded-lg mb-4 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
          <p className="text-sm">NFT #{tokenId}</p>
        </div>
      </div>

      <h2 className="text-lg font-bold mb-2">NFT #{tokenId}</h2>
      <p className="mb-1 text-sm text-gray-600">Sale ID: {saleId}</p>
      <p className="mb-2 font-semibold">Price: {formatPrice(price, coinDenom)}</p>
      <p className="mb-2 text-sm text-gray-600">
        Seller: {seller?.slice(0, 10)}...{seller?.slice(-6)}
      </p>
      <p className={`mb-3 text-sm font-medium ${getStatusColor(status)}`}>
        Status: {getStatusText(status)}
      </p>
      
      <div className="flex gap-2">
        <button
          onClick={handleCardClick}
          className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
        >
          View Details
        </button>
        
        {status === 'open' && !isSold && (
          <button
            onClick={handleBuyClick}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
          >
            Buy Now
          </button>
        )}
        
        {status === 'executed' && (
          <div className="flex-1 px-4 py-2 bg-gray-200 text-gray-600 rounded text-center text-sm">
            Sold
          </div>
        )}
      </div>
    </div>
  );
};

export default NFTCard;
