import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
    }
    
    // Handle CosmJS and other blockchain-related modules
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push({
        'utf-8-validate': 'utf-8-validate',
        'bufferutil': 'bufferutil',
      });
    }
    
    return config;
  },
  
  // Ensure proper transpilation of CosmJS modules
  transpilePackages: [
    '@cosmjs/stargate',
    '@cosmjs/cosmwasm-stargate',
    '@cosmjs/crypto',
    '@cosmjs/encoding',
    '@cosmjs/math',
    '@cosmjs/utils'
  ],

  // Add headers for CSP to allow blockchain operations
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';
    
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Allow eval in development for blockchain libraries, more restrictive in production
              isDev 
                ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' 'wasm-unsafe-eval'" 
                : "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https: http://137.184.182.11:26657 wss: ws:",
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              // Allow WebAssembly for blockchain libraries in development
              isDev ? "worker-src 'self' blob:" : "",
              isDev ? "" : "upgrade-insecure-requests"
            ].filter(Boolean).join('; ')
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ],
      },
    ];
  },
};

export default nextConfig;
