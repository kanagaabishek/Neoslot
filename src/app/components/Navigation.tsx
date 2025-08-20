"use client"

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from '../hooks/useWallet';

const Navigation: React.FC = () => {
  const pathname = usePathname();
  const { address, isConnecting, connectWallet, disconnectWallet, formatAddress } = useWallet();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { href: '/', label: 'Marketplace', icon: '🏠' },
    { href: '/auction', label: 'Auctions', icon: '⚡' },
    { href: '/mint', label: 'Mint NFT', icon: '🎨' },
    { href: '/profile', label: 'Profile', icon: '👤' },
  ];

  const WalletButton = ({ isMobile = false }: { isMobile?: boolean }) => {
    if (address) {
      return (
        <div className={`flex items-center ${isMobile ? 'flex-col space-y-3' : 'space-x-4'}`}>
          <div className={`flex items-center space-x-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg ${isMobile ? 'w-full justify-center' : ''}`}>
            <div className="w-2 h-2 bg-black rounded-full"></div>
            <span className="text-sm font-medium text-black">
              {formatAddress(address)}
            </span>
          </div>
          <button
            onClick={disconnectWallet}
            className={`px-4 py-2 text-sm font-medium text-black border border-black rounded-lg hover:bg-black hover:text-white transition-all duration-200 ${isMobile ? 'w-full' : ''}`}
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
        className={`px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 font-medium ${isMobile ? 'w-full justify-center' : ''}`}
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-16 sm:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 sm:space-x-3">
            <span className="text-xl sm:text-2xl">🧠</span>
            <span className="text-xl sm:text-2xl font-bold text-black">NeoSlot</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
            <div className="flex space-x-6">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-black text-white'
                        : 'text-black hover:bg-gray-100'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
            
            <WalletButton />
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg text-black hover:bg-gray-100 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 py-4 space-y-4">
            <div className="space-y-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-black text-white'
                        : 'text-black hover:bg-gray-100'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
            
            <div className="pt-4 border-t border-gray-200">
              <WalletButton isMobile={true} />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
