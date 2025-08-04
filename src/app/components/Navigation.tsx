"use client"

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from '../hooks/useWallet';

const Navigation: React.FC = () => {
  const pathname = usePathname();
  const { address, isConnecting, connectWallet, disconnectWallet, formatAddress } = useWallet();

  const navItems = [
    { href: '/', label: 'Marketplace', icon: '🏠' },
    { href: '/mint', label: 'Mint NFT', icon: '🎨' },
    { href: '/profile', label: 'Profile', icon: '👤' },
  ];

  const WalletButton = () => {
    if (address) {
      return (
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium text-green-700">
              {formatAddress(address)}
            </span>
          </div>
          <button
            onClick={disconnectWallet}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Disconnect
          </button>
        </div>
      );
    }

    return (
      <button
        onClick={connectWallet}
        disabled={isConnecting}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
      >
        {isConnecting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <span>🔗</span>
            <span>Connect Wallet</span>
          </>
        )}
      </button>
    );
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl">🧠</span>
            <span className="text-xl font-bold text-gray-900">NeoSlot</span>
          </Link>

          {/* Navigation Links and Wallet */}
          <div className="flex items-center space-x-6">
            <div className="flex space-x-8">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
            
            {/* Wallet Connection */}
            <WalletButton />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
