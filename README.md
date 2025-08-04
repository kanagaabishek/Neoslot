# NeoSlot - Andromeda NFT Marketplace

A Next.js frontend for an NFT marketplace built on the Andromeda testnet using CosmWasm smart contracts.

## Features

- Connect to Keplr wallet
- Browse NFTs for sale on the marketplace
- Buy NFTs with ANDR tokens
- View sale status and pricing
- Responsive design with Tailwind CSS

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables by copying `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

3. Update the environment variables with your contract addresses and network settings.

4. Start the development server:
```bash
npm run dev
```

## Environment Variables

- `NEXT_PUBLIC_CHAIN_RPC`: Andromeda testnet RPC endpoint
- `NEXT_PUBLIC_CHAIN_REST`: Andromeda testnet REST endpoint  
- `NEXT_PUBLIC_CHAIN_ID`: Chain ID (galileo-4 for Andromeda testnet)
- `NEXT_PUBLIC_CW721_ADDRESS`: NFT contract address
- `NEXT_PUBLIC_MARKETPLACE_ADDRESS`: Marketplace contract address

## Marketplace Contract Queries

The marketplace contract supports the following queries:

### sale_infos_for_address
Get all sales for a specific CW721 contract:
```javascript
{
  sale_infos_for_address: { 
    token_address: "andr1...", // CW721 contract address
    start_after: null,
    limit: 50
  }
}
```

### sale_state
Get detailed information about a specific sale:
```javascript
{
  sale_state: { 
    sale_id: "1" // Sale ID from sale_infos_for_address
  }
}
```

### sale_ids
Get sale IDs for a specific token:
```javascript
{
  sale_ids: { 
    token_address: "andr1...", // CW721 contract address
    token_id: "token-name"
  }
}
```

## Sale Status Values

- `open`: NFT is available for purchase
- `executed`: NFT has been sold

## Technology Stack

- Next.js 15 with TypeScript
- Tailwind CSS for styling
- CosmJS for blockchain interaction
- Keplr wallet integration

## Architecture

- `src/app/page.tsx`: Main marketplace page with wallet connection and NFT display
- `src/app/components/NFTcard.tsx`: Individual NFT card component
- `src/app/utils/andrClient.ts`: CosmWasm client utilities with dynamic imports for SSR compatibility
