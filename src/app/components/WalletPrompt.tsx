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
  const { isConnected, address, connectWallet, disconnectWallet, isConnecting, formatAddress } = useWallet();

  // Don't show if wallet is connected and showOnlyWhenDisconnected is true
  if (showOnlyWhenDisconnected && isConnected) {
    return (
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-3 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
          <span className="text-green-600">✅</span>
          <span className="text-green-800 font-medium">
            Connected: {formatAddress(address)}
          </span>
          <button
            onClick={disconnectWallet}
            className="text-green-600 hover:text-green-800 ml-2 px-2 py-1 text-sm hover:bg-green-100 rounded"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center py-16 sm:py-24 lg:py-32 ${className}`}>
      <div className="text-center max-w-md mx-auto px-4 sm:px-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8 lg:p-12">
          {/* Icon */}
          <div className="mb-6 sm:mb-8">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl sm:text-3xl">🔗</span>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">
            {title}
          </h2>

          {/* Message */}
          <p className="text-gray-600 mb-8 sm:mb-10 leading-relaxed text-sm sm:text-base">
            {message}
          </p>

          {/* Connect Button */}
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="w-full px-6 sm:px-8 py-3 sm:py-4 bg-black text-white rounded-lg hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 font-medium text-sm sm:text-base"
          >
            {isConnecting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white"></div>
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
          <div className="text-xs sm:text-sm text-gray-500 mt-4 sm:mt-6 space-y-2">
            <p>
              Don&apos;t have Keplr?{' '}
              <a
                href="https://www.keplr.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-black hover:underline font-medium"
              >
                Install it here
              </a>
            </p>
            <p className="text-gray-400">
              Keplr Status: {typeof window !== 'undefined' && window.keplr ? '✅ Installed' : '❌ Not Found'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletPrompt;
