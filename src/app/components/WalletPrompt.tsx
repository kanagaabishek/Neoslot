"use client"

import React from 'react';
import { useWallet } from '../hooks/useWallet';

interface WalletPromptProps {
  title?: string;
  message?: string;
  showOnlyWhenDisconnected?: boolean;
  className?: string;
}

const WalletPrompt: React.FC<WalletPromptProps> = ({
  title = "Connect Your Wallet",
  message = "Please connect your Keplr wallet to continue",
  showOnlyWhenDisconnected = true,
  className = ""
}) => {
  const { isConnected, connectWallet, isConnecting } = useWallet();

  // Don't show if wallet is connected and showOnlyWhenDisconnected is true
  if (showOnlyWhenDisconnected && isConnected) {
    return null;
  }

  return (
    <div className={`flex items-center justify-center py-20 ${className}`}>
      <div className="text-center max-w-md mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8 border border-gray-200">
          {/* Icon */}
          <div className="mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl">🔗</span>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {title}
          </h2>

          {/* Message */}
          <p className="text-gray-600 mb-8 leading-relaxed">
            {message}
          </p>

          {/* Connect Button */}
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isConnecting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <span>🔗</span>
                <span>Connect Keplr Wallet</span>
              </>
            )}
          </button>

          {/* Help Text */}
          <p className="text-sm text-gray-500 mt-4">
            Don't have Keplr?{' '}
            <a
              href="https://www.keplr.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 underline"
            >
              Install it here
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default WalletPrompt;
