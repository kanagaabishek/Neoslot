// Simple script to test marketplace contract queries
const { CosmWasmClient } = require('@cosmjs/cosmwasm-stargate');

async function testMarketplaceQueries() {
    try {
        const rpc = 'http://137.184.182.11:26657';
        const marketplace = 'andr1pux5demcm9xwcsdwshg6splta5ajrkq26w4tkf636vnaa8k49zxqnxlnfg';
        const cw721 = 'andr1tkjswumejtgqd9f0atw8ve0qlfswrmn2202wv45gp40rt8ch7fvs6e83lu';
        
        console.log('Connecting to RPC:', rpc);
        const client = await CosmWasmClient.connect(rpc);
        
        console.log('Connected! Querying marketplace contract:', marketplace);
        
        // Test sale_ids query with both token_address and token_id
        console.log('\n--- Testing sale_ids with token_address and token_id ---');
        try {
            const saleIdsResponse = await client.queryContractSmart(marketplace, {
                sale_ids: { 
                    token_address: cw721,
                    token_id: "Slot-001"
                }
            });
            console.log('sale_ids response:', saleIdsResponse);
            
            // If we have sale IDs, test getting a sale state
            if (saleIdsResponse.sale_ids && saleIdsResponse.sale_ids.length > 0) {
                const firstSaleId = saleIdsResponse.sale_ids[0];
                console.log(`\n--- Testing sale_state for sale ID: ${firstSaleId} ---`);
                
                const saleState = await client.queryContractSmart(marketplace, {
                    sale_state: { sale_id: firstSaleId }
                });
                console.log('sale_state response:', saleState);
            }
            
        } catch (error) {
            console.error('Error with sale_ids query:', error.message);
        }
        
        // Also test sale_state directly with the known sale_id from sale_infos_for_address
        console.log('\n--- Testing sale_state with known sale_id: 1 ---');
        try {
            const saleState = await client.queryContractSmart(marketplace, {
                sale_state: { sale_id: "1" }
            });
            console.log('sale_state response:', saleState);
        } catch (error) {
            console.error('Error with sale_state query:', error.message);
        }
        
        // Try sale_infos_for_address with correct parameters
        console.log('\n--- Testing sale_infos_for_address ---');
        try {
            const saleInfosResponse = await client.queryContractSmart(marketplace, {
                sale_infos_for_address: { 
                    token_address: cw721,
                    start_after: null,
                    limit: 10
                }
            });
            console.log('sale_infos_for_address response:', saleInfosResponse);
        } catch (error) {
            console.error('Error with sale_infos_for_address query:', error.message);
        }
        
        // Try to get token info from the CW721 contract first
        console.log('\n--- Getting token info from CW721 ---');
        try {
            const tokenInfoResponse = await client.queryContractSmart(cw721, {
                num_tokens: {}
            });
            console.log('num_tokens response:', tokenInfoResponse);
            
            if (tokenInfoResponse.count > 0) {
                // Try to get info for the first token
                const tokensResponse = await client.queryContractSmart(cw721, {
                    all_tokens: { limit: 5 }
                });
                console.log('all_tokens response:', tokensResponse);
                
                if (tokensResponse.tokens && tokensResponse.tokens.length > 0) {
                    const firstToken = tokensResponse.tokens[0];
                    console.log(`\n--- Testing sale queries for token: ${firstToken} ---`);
                    
                    // Try sale_state for this token
                    try {
                        const saleStateResponse = await client.queryContractSmart(marketplace, {
                            sale_state: { token_id: firstToken }
                        });
                        console.log('sale_state response:', saleStateResponse);
                    } catch (saleError) {
                        console.error('Error with sale_state query:', saleError.message);
                    }
                }
            }
            
        } catch (error) {
            console.error('Error querying CW721:', error.message);
        }
        
    } catch (error) {
        console.error('Error connecting or querying:', error);
    }
}

testMarketplaceQueries();
