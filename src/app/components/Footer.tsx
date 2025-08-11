import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-200 mt-16 sm:mt-24 lg:mt-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
          {/* Brand */}
          <div>
            <div className="flex items-center space-x-2 sm:space-x-3 mb-4 sm:mb-6">
              <span className="text-xl sm:text-2xl">🧠</span>
              <span className="text-xl sm:text-2xl font-bold text-black">NeoSlot</span>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed">
              The premier NFT marketplace on the Andromeda blockchain. 
              Mint, buy, and sell unique digital assets with ease.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-bold text-black mb-4 sm:mb-6">Marketplace</h3>
            <ul className="space-y-2 sm:space-y-3 text-sm text-gray-600">
              <li><a href="/" className="hover:text-black transition-colors">Browse NFTs</a></li>
              <li><a href="/mint" className="hover:text-black transition-colors">Mint NFT</a></li>
            </ul>
          </div>

          {/* Network Info */}
          <div>
            <h3 className="font-bold text-black mb-4 sm:mb-6">Network</h3>
            <ul className="space-y-2 sm:space-y-3 text-sm text-gray-600">
              <li>Andromeda Protocol</li>
              <li>Chain ID: galileo-4</li>
              <li>Testnet</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200 mt-8 sm:mt-12 pt-6 sm:pt-8 text-center text-sm text-gray-600">
          <p>&copy; 2025 NeoSlot. Built on Andromeda Protocol.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
