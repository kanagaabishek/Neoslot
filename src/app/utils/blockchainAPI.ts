// Client-side wrapper for server-side blockchain API
// This completely bypasses all browser RPC restrictions

class BlockchainAPI {
  private static async request(type: string, params?: Record<string, unknown>) {
    console.log(`Client: Making ${type} request via server API`);
    
    try {
      const response = await fetch('/api/blockchain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, params }),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Server request failed');
      }

      console.log(`Client: ${type} request successful`);
      return result.data;
    } catch (error) {
      console.error(`Client: ${type} request failed:`, error);
      throw error;
    }
  }

  static async getMarketplaceSales() {
    const result = await this.request('marketplace_sales');
    return result.sales || [];
  }

  static async getAuctionList() {
    const result = await this.request('auction_list');
    return result.auctions || [];
  }

  static async getAuctionDetails(tokenId: string) {
    const result = await this.request('auction_details', { tokenId });
    if (result.error) {
      throw new Error(result.error);
    }
    return result.auction;
  }

  static async getNFTInfo(tokenId: string) {
    const result = await this.request('nft_info', { tokenId });
    return result;
  }

  static async getNFTDetails(tokenId: string) {
    const result = await this.request('nft_details', { tokenId });
    return result;
  }

  static async getUserNFTs(address: string) {
    const result = await this.request('user_nfts', { address });
    return result.nfts || [];
  }
}

export default BlockchainAPI;
