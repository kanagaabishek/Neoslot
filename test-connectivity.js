// Simple test script to verify contract connectivity
const { CosmWasmClient } = require("@cosmjs/cosmwasm-stargate");

async function testConnectivity() {
  const rpc = "http://137.184.182.11:26657";
  const cw721 = "andr1tkjswumejtgqd9f0atw8ve0qlfswrmn2202wv45gp40rt8ch7fvs6e83lu";
  const marketplace = "andr1pux5demcm9xwcsdwshg6splta5ajrkq26w4tkf636vnaa8k49zxqnxlnfg";

  console.log("Environment variables:");
  console.log("RPC:", rpc);
  console.log("CW721:", cw721);
  console.log("Marketplace:", marketplace);
  console.log("");

  try {
    // Test RPC connectivity
    console.log("Testing RPC connectivity...");
    const response = await fetch(rpc + "/status");
    if (response.ok) {
      const data = await response.json();
      console.log("✅ RPC is reachable");
      console.log("Chain ID:", data.result?.node_info?.network || "Unknown");
      console.log("Latest block:", data.result?.sync_info?.latest_block_height || "Unknown");
    } else {
      console.log("❌ RPC returned error:", response.status);
      return;
    }

    // Test CosmWasm client
    console.log("\nTesting CosmWasm client...");
    const client = await CosmWasmClient.connect(rpc);
    console.log("✅ CosmWasm client connected");

    // Test CW721 contract
    console.log("\nTesting CW721 contract...");
    try {
      const contractInfo = await client.queryContractSmart(cw721, { contract_info: {} });
      console.log("✅ CW721 contract is responsive");
      console.log("Contract info:", contractInfo);
    } catch (err) {
      console.log("⚠️  CW721 contract_info query failed, trying alternative queries...");
      
      try {
        const minter = await client.queryContractSmart(cw721, { minter: {} });
        console.log("✅ CW721 minter query successful:", minter);
      } catch (err2) {
        console.log("❌ CW721 contract is not responding:", err2.message);
      }
    }

    // Test Marketplace contract
    console.log("\nTesting Marketplace contract...");
    try {
      const marketplaceInfo = await client.queryContractSmart(marketplace, { contract_info: {} });
      console.log("✅ Marketplace contract is responsive");
      console.log("Marketplace info:", marketplaceInfo);
    } catch (err) {
      console.log("⚠️  Marketplace contract_info query failed, trying alternative queries...");
      
      try {
        const config = await client.queryContractSmart(marketplace, { config: {} });
        console.log("✅ Marketplace config query successful:", config);
      } catch (err2) {
        console.log("❌ Marketplace contract is not responding:", err2.message);
      }
    }

  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testConnectivity().catch(console.error);
