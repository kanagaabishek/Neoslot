"use client"

import { useState, useEffect } from 'react';
import { setupKeplrChain } from '../utils/keplrChain';

export const useWallet = () => {
  const [address, setAddress] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);

  const connectWallet = async () => {
    console.log('🔗 Attempting to connect wallet...');
    
    if (!window.keplr) {
      console.error('❌ Keplr extension not found');
      alert('Please install Keplr extension first. Visit https://www.keplr.app/ to download it.');
      return;
    }

    console.log('✅ Keplr extension detected');

    try {
      setIsConnecting(true);
      console.log('🔄 Setting up Keplr chain...');
      
      const offlineSigner = await setupKeplrChain();
      console.log('✅ Chain setup successful');
      
      console.log('🔄 Getting accounts...');
      const accounts = await offlineSigner.getAccounts();
      console.log('📋 Accounts retrieved:', accounts.length);
      
      if (accounts.length > 0) {
        const newAddress = accounts[0].address;
        console.log('✅ Wallet connected:', newAddress.slice(0, 10) + '...');
        
        setAddress(newAddress);
        localStorage.setItem('walletAddress', newAddress);
        
        // Dispatch custom event for other components to listen
        window.dispatchEvent(new CustomEvent('walletConnected', { 
          detail: { address: newAddress } 
        }));
        
        return newAddress;
      } else {
        console.error('❌ No accounts found');
        alert('No accounts found in Keplr wallet. Please create an account first.');
      }
    } catch (error) {
      console.error('❌ Failed to connect wallet:', error);
      
      let errorMessage = 'Failed to connect wallet. ';
      
      if (error instanceof Error) {
        if (error.message.includes('Request rejected')) {
          errorMessage += 'Connection was rejected. Please try again and approve the connection.';
        } else if (error.message.includes('chain')) {
          errorMessage += 'Failed to add Andromeda chain. Please check your network settings.';
        } else {
          errorMessage += error.message;
        }
      } else {
        errorMessage += 'Unknown error occurred.';
      }
      
      alert(errorMessage);
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
