import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-200 mt-20">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-2xl">🧠</span>
              <span className="text-xl font-bold text-gray-900">NeoSlot</span>
            </div>
            <p className="text-gray-600 text-sm">
              The premier NFT marketplace on the Andromeda blockchain. 
              Mint, buy, and sell unique digital assets with ease.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Marketplace</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><a href="/" className="hover:text-gray-900 transition-colors">Browse NFTs</a></li>
              <li><a href="/mint" className="hover:text-gray-900 transition-colors">Mint NFT</a></li>
            </ul>
          </div>

          {/* Network Info */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Network</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>Andromeda Protocol</li>
              <li>Chain ID: galileo-4</li>
              <li>Testnet</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200 mt-8 pt-8 text-center text-sm text-gray-600">
          <p>&copy; 2025 NeoSlot. Built on Andromeda Protocol.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
