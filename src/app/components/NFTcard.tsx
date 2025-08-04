// components/NFTCard.tsx
import React from 'react';

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

  return (
    <div className="border rounded-lg p-4 shadow bg-white mb-4">
      <h2 className="text-lg font-bold mb-2">NFT #{tokenId}</h2>
      <p className="mb-1 text-sm text-gray-600">Sale ID: {saleId}</p>
      <p className="mb-2 font-semibold">Price: {formatPrice(price, coinDenom)}</p>
      <p className="mb-2 text-sm text-gray-600">
        Seller: {seller?.slice(0, 10)}...{seller?.slice(-6)}
      </p>
      <p className={`mb-3 text-sm font-medium ${getStatusColor(status)}`}>
        Status: {getStatusText(status)}
      </p>
      {status === 'open' && !isSold && (
        <button
          onClick={onBuy}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Buy NFT
        </button>
      )}
      {status === 'executed' && (
        <div className="px-4 py-2 bg-gray-200 text-gray-600 rounded text-center">
          Already Sold
        </div>
      )}
    </div>
  );
};

export default NFTCard;
