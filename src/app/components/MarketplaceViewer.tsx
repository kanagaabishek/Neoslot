"use client"

import React, { useState, useEffect } from 'react';
import { getQueryClient } from '../utils/andrClient';

interface MarketplaceViewerProps {
  rpcUrl: string;
  marketplaceAddress: string;
  cw721Address: string;
}

interface SaleInfo {
  sale_id: string;
  coin_denom: string;
  price: string;
  status: string;
  start_time: any;
  end_time: any;
  recipient: any;
}

export default function MarketplaceViewer({ rpcUrl, marketplaceAddress, cw721Address }: MarketplaceViewerProps) {
  const [sales, setSales] = useState<SaleInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadSales = async () => {
    setLoading(true);
    setError("");
    
    try {
      const client = await getQueryClient(rpcUrl);
      const salesData: SaleInfo[] = [];
      
      // Try to query sale IDs 1 through 10
      for (let i = 1; i <= 10; i++) {
        try {
          const saleState = await client.queryContractSmart(marketplaceAddress, {
            sale_state: { sale_id: i.toString() }
          });
          salesData.push({
            sale_id: i.toString(),
            ...saleState
          });
        } catch (err) {
          // Sale doesn't exist, continue
          break;
        }
      }
      
      setSales(salesData);
    } catch (err) {
      setError(`Failed to load marketplace: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mt-6 border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-black">Marketplace Listings</h2>
        <button
          onClick={loadSales}
          disabled={loading}
          className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors font-medium"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-gray-50 border border-gray-300 rounded-lg">
          <p className="text-black">{error}</p>
        </div>
      )}

      {sales.length === 0 && !loading && !error && (
        <div className="text-gray-600 text-center py-4">
          No sales found in marketplace
        </div>
      )}

      <div className="space-y-4">
        {sales.map((sale) => (
          <div key={sale.sale_id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-black">Sale ID: {sale.sale_id}</span>
              <span className={`px-2 py-1 rounded text-xs ${
                sale.status === 'open' ? 'bg-gray-100 text-black' : 
                sale.status === 'executed' ? 'bg-gray-200 text-gray-700' :
                'bg-gray-50 text-gray-600'
              }`}>
                {sale.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-600">Price:</span>
                <span className="ml-2 font-medium">
                  {(parseInt(sale.price) / 1_000_000).toFixed(6)} {sale.coin_denom.replace('u', '').toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-slate-600">Recipient:</span>
                <span className="ml-2 font-mono text-xs">
                  {sale.recipient.address.slice(0, 10)}...{sale.recipient.address.slice(-6)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
