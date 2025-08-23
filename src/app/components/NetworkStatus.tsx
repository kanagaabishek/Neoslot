"use client"

import React, { useState, useEffect } from 'react';
import BlockchainAPI from '../utils/blockchainAPI';

interface NetworkStatusProps {
  rpcUrl?: string; // Made optional since we're using server API
}

export default function NetworkStatus({ rpcUrl }: NetworkStatusProps) {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkConnectivity = async () => {
    setStatus('checking');
    try {
      // Use server API to test connectivity instead of direct RPC calls
      // This avoids browser CORS and mixed content issues
      await BlockchainAPI.getMarketplaceSales();
      setStatus('connected');
      setLastCheck(new Date());
    } catch (error) {
      console.error('❌ RPC connectivity test failed for', rpcUrl, ':', error);
      setStatus('disconnected');
      setLastCheck(new Date());
    }
  };

  useEffect(() => {
    checkConnectivity();
    // Check every 30 seconds
    const interval = setInterval(checkConnectivity, 30000);
    return () => clearInterval(interval);
  }, []); // Removed rpcUrl dependency since we're using server API

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'text-black bg-gray-50 border-gray-200';
      case 'disconnected': return 'text-black bg-gray-100 border-gray-300';
      case 'checking': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected': return '✅ Blockchain Connected';
      case 'disconnected': return '❌ Blockchain Disconnected';
      case 'checking': return '🔄 Checking...';
      default: return 'Unknown';
    }
  };

  return (
    <div className={`p-3 rounded-lg border ${getStatusColor()}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{getStatusText()}</span>
        <button
          onClick={checkConnectivity}
          className="text-xs px-2 py-1 rounded hover:bg-opacity-50 bg-current bg-opacity-10 transition-colors"
          disabled={status === 'checking'}
        >
          Refresh
        </button>
      </div>
      <div className="text-xs mt-1 opacity-75">
        Status via Server API
        {lastCheck && (
          <div>Last check: {lastCheck.toLocaleTimeString()}</div>
        )}
      </div>
    </div>
  );
}
