# NeoSlot - Andromeda NFT Marketplace

A Next.js frontend for an NFT marketplace built on the Andromeda testnet using CosmWasm smart contracts.

## Features

- **🔗 Wallet Integration**: Connect to Keplr wallet
- **🖼️ Browse NFTs**: View NFTs for sale on the marketplace with detailed cards
- **💰 Buy NFTs**: Purchase NFTs with ANDR tokens
- **🎨 Mint NFTs**: Create and mint new NFTs with metadata and attributes
- **📋 List for Sale**: Automatically list newly minted NFTs on the marketplace
- **📄 NFT Details**: View detailed NFT information including metadata, attributes, and sale history
- **🎯 Responsive Design**: Mobile-friendly interface with Tailwind CSS

## Pages

### 🏠 Marketplace (`/`)
- Browse all available NFTs
- Connect wallet functionality
- Quick buy options
- Navigate to detailed NFT views

### 🎨 Mint NFT (`/mint`)
- Create new NFTs with custom metadata
- Add images, descriptions, and attributes
- Set sale price
- Automatically mint, approve, and list for sale

### 📄 NFT Details (`/nft/[tokenId]`)
- Detailed NFT information
- Large image display
- Complete metadata and attributes
- Sale information and status
- Purchase functionality
- Technical details (Token URI, etc.)

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

## Environment Configuration

The application requires environment variables to connect to the Andromeda blockchain and smart contracts. Create a `.env.local` file in the root directory with the following variables:

```env
# RPC Configuration
NEXT_PUBLIC_RPC_URL=http://137.184.182.11:26657
NEXT_PUBLIC_CHAIN_RPC=http://137.184.182.11:26657
NEXT_PUBLIC_CHAIN_REST=http://137.184.182.11:1317

# Fallback RPCs (optional)
NEXT_PUBLIC_FALLBACK_RPC_1=http://137.184.182.11:26657
NEXT_PUBLIC_FALLBACK_RPC_2=http://137.184.182.11:26657
NEXT_PUBLIC_FALLBACK_RPC_3=http://137.184.182.11:26657
NEXT_PUBLIC_FALLBACK_RPC_4=http://137.184.182.11:26657

# Chain Configuration
NEXT_PUBLIC_CHAIN_ID=galileo-4

# Contract Addresses
NEXT_PUBLIC_CW721_ADDRESS=andr1tkjswumejtgqd9f0atw8ve0qlfswrmn2202wv45gp40rt8ch7fvs6e83lu
NEXT_PUBLIC_MARKETPLACE_ADDRESS=andr1pux5demcm9xwcsdwshg6splta5ajrkq26w4tkf636vnaa8k49zxqnxlnfg
NEXT_PUBLIC_AUCTION_ADDRESS=andr1j2gwn97plye7h0xh0j2g8e7huwr6f3jqzrln64c7aqwlrg3n2ueq0p0zss
```

### Environment File Priority
Next.js loads environment files in this order:
1. `.env.local` (highest priority, git-ignored)
2. `.env` (lower priority)

**Note**: Use `.env.local` for your actual configuration to avoid committing sensitive data to git.

### Testing Environment Configuration
Run the environment test script to verify your configuration:
```bash
node test-env.js
```

Or visit `/debug-env` in your browser when the dev server is running to see the current environment state.

## Smart Contract Integration

### NFT Minting Process

1. **Mint NFT**: Create NFT with metadata on CW721 contract
2. **Approve Marketplace**: Allow marketplace to transfer the NFT
3. **Start Sale**: List the NFT for sale with specified price

### Marketplace Contract Queries

#### sale_infos_for_address
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

#### sale_state
Get detailed information about a specific sale:
```javascript
{
  sale_state: { 
    sale_id: "1" // Sale ID from sale_infos_for_address
  }
}
```

#### sale_ids
Get sale IDs for a specific token:
```javascript
{
  sale_ids: { 
    token_address: "andr1...", // CW721 contract address
    token_id: "token-name"
  }
}
```

### CW721 Contract Queries

#### nft_info
Get NFT metadata:
```javascript
{
  nft_info: { 
    token_id: "token-name"
  }
}
```

#### owner_of
Get NFT owner:
```javascript
{
  owner_of: { 
    token_id: "token-name"
  }
}
```

## NFT Metadata Structure

```typescript
interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
}
```

## Sale Status Values

- `open`: NFT is available for purchase
- `executed`: NFT has been sold

## Technology Stack

- **Frontend**: Next.js 15 with TypeScript
- **Styling**: Tailwind CSS for responsive design
- **Blockchain**: CosmJS for CosmWasm interaction
- **Wallet**: Keplr wallet integration
- **Network**: Andromeda Protocol (galileo-4 testnet)

## Architecture

- `src/app/page.tsx`: Main marketplace page with wallet connection and NFT grid
- `src/app/mint/page.tsx`: NFT minting form with metadata input
- `src/app/nft/[tokenId]/page.tsx`: Detailed NFT view page
- `src/app/components/NFTcard.tsx`: Reusable NFT card component
- `src/app/utils/andrClient.ts`: CosmWasm client utilities with SSR compatibility
- `src/types/keplr.d.ts`: TypeScript declarations for Keplr wallet

## User Workflow

1. **Connect Wallet**: Users connect their Keplr wallet
2. **Browse Marketplace**: View available NFTs in a grid layout
3. **View Details**: Click on NFTs to see detailed information
4. **Purchase NFTs**: Buy NFTs directly from detail or card view
5. **Mint New NFTs**: Create new NFTs with custom metadata
6. **Automatic Listing**: Newly minted NFTs are automatically listed for sale

## Development Notes

- Uses dynamic imports for CosmWasm clients to ensure SSR compatibility
- Implements proper error handling and loading states
- Responsive design works on mobile and desktop
- TypeScript support with proper type declarations
- Environment-based configuration for different networks
