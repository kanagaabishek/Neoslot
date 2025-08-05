"use client"

import React, { useState, useEffect } from 'react';
import { testRpcConnectivity } from '../utils/andrClient';

interface NetworkStatusProps {
  rpcUrl: string;
}

export default function NetworkStatus({ rpcUrl }: NetworkStatusProps) {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkConnectivity = async () => {
    setStatus('checking');
    try {
      const isConnected = await testRpcConnectivity(rpcUrl);
      setStatus(isConnected ? 'connected' : 'disconnected');
      setLastCheck(new Date());
    } catch (error) {
      console.error('Network check failed:', error);
      setStatus('disconnected');
      setLastCheck(new Date());
    }
  };

  useEffect(() => {
    checkConnectivity();
    // Check every 30 seconds
    const interval = setInterval(checkConnectivity, 30000);
    return () => clearInterval(interval);
  }, [rpcUrl]);

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'text-green-600 bg-green-50';
      case 'disconnected': return 'text-red-600 bg-red-50';
      case 'checking': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected': return '✅ RPC Connected';
      case 'disconnected': return '❌ RPC Disconnected';
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
          className="text-xs px-2 py-1 rounded hover:bg-opacity-50 bg-current bg-opacity-10"
          disabled={status === 'checking'}
        >
          Refresh
        </button>
      </div>
      <div className="text-xs mt-1 opacity-75">
        RPC: {rpcUrl}
        {lastCheck && (
          <div>Last check: {lastCheck.toLocaleTimeString()}</div>
        )}
      </div>
    </div>
  );
}
