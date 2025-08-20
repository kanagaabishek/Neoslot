"use client"

import { useState, useEffect } from 'react';
import { setupKeplrChain } from '../utils/keplrChain';

export const useWallet = () => {
  const [address, setAddress] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);

  const connectWallet = async () => {
    if (!window.keplr) {
      alert('Please install Keplr extension');
      return;
    }

    try {
      setIsConnecting(true);
      
      const offlineSigner = await setupKeplrChain();
      const accounts = await offlineSigner.getAccounts();
      
      if (accounts.length > 0) {
        const newAddress = accounts[0].address;
        setAddress(newAddress);
        localStorage.setItem('walletAddress', newAddress);
        
        // Dispatch custom event for other components to listen
        window.dispatchEvent(new CustomEvent('walletConnected', { 
          detail: { address: newAddress } 
        }));
        
        return newAddress;
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      alert('Failed to connect wallet. Please try again.');
      return null;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAddress('');
    localStorage.removeItem('walletAddress');
    
    // Dispatch custom event for other components to listen
    window.dispatchEvent(new CustomEvent('walletDisconnected'));
  };

  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  useEffect(() => {
    // Check if wallet was previously connected
    const savedAddress = localStorage.getItem('walletAddress');
    if (savedAddress) {
      setAddress(savedAddress);
    }

    // Listen for account changes
    if (window.keplr) {
      const handleKeystoreChange = () => {
        // Re-connect when account changes
        if (address) {
          connectWallet();
        }
      };

      window.addEventListener('keplr_keystorechange', handleKeystoreChange);
      
      // Listen for wallet events from other components
      const handleWalletConnected = (event: Event) => {
        const customEvent = event as CustomEvent<{ address: string }>;
        setAddress(customEvent.detail.address);
      };
      
      const handleWalletDisconnected = () => {
        setAddress('');
      };

      window.addEventListener('walletConnected', handleWalletConnected);
      window.addEventListener('walletDisconnected', handleWalletDisconnected);

      return () => {
        window.removeEventListener('keplr_keystorechange', handleKeystoreChange);
        window.removeEventListener('walletConnected', handleWalletConnected);
        window.removeEventListener('walletDisconnected', handleWalletDisconnected);
      };
    }
  }, [address]);

  return {
    address,
    isConnecting,
    connectWallet,
    disconnectWallet,
    formatAddress,
    isConnected: !!address
  };
};
