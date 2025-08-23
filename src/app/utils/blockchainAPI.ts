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

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Client: Server responded with ${response.status}: ${errorText}`);
        throw new Error(`Server error (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        const errorMsg = result.error || 'Unknown server error';
        console.error(`Client: Server API error:`, errorMsg);
        throw new Error(`Failed to fetch NFTs: ${errorMsg}. Please check your network connection.`);
      }

      console.log(`Client: ${type} request successful`);
      return result.data;
    } catch (error) {
      console.error(`Client: ${type} request failed:`, error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Failed to connect to server. Please check your internet connection.');
      }
      
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

  // New methods for mint page
  static async getContractInfo(address: string) {
    const result = await this.request('contract_info', { address });
    return result;
  }

  static async getMarketplaceOwner() {
    const result = await this.request('marketplace_owner');
    return result;
  }

  static async getMarketplaceType() {
    const result = await this.request('marketplace_type');
    return result;
  }

  static async getLatestSale(tokenId: string) {
    const result = await this.request('latest_sale', { tokenId });
    return result;
  }

  static async getSaleIds(tokenId: string) {
    const result = await this.request('sale_ids', { tokenId });
    return result;
  }

  static async getSaleState(saleId: string) {
    const result = await this.request('sale_state', { saleId });
    return result;
  }

  static async getSaleInfos(tokenId: string) {
    const result = await this.request('sale_infos', { tokenId });
    return result;
  }

  static async getUserNFTs(address: string) {
    const result = await this.request('user_nfts', { address });
    return result.nfts || [];
  }
}

export default BlockchainAPI;
