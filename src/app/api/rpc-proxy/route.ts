import { NextRequest, NextResponse } from "next/server";

const RPC_ENDPOINTS = [
  process.env.NEXT_PUBLIC_RPC_URL || "http://137.184.182.11:26657",
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("Proxy received request:", JSON.stringify(body, null, 2));

    for (const endpoint of RPC_ENDPOINTS) {
      try {
        console.log(`Trying endpoint: ${endpoint}`);
        
        let response;
        if (body.jsonrpc) {
          // JSON-RPC request (like abci_query for CosmWasm)
          console.log("Making JSON-RPC request");
          response = await fetch(endpoint, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15000), // Increased timeout
          });
        } else {
          // REST-style request
          const { path = "/status", method = "GET" } = body;
          const rpcUrl = `${endpoint}${path}`;
          console.log(`Making ${method} request to: ${rpcUrl}`);
          response = await fetch(rpcUrl, {
            method,
            headers: { 
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            signal: AbortSignal.timeout(15000),
          });
        }

        console.log(`Response status: ${response.status}`);
        
        if (!response.ok) {
          console.warn(`Endpoint ${endpoint} returned ${response.status}: ${response.statusText}`);
          continue;
        }

        const result = await response.json();
        console.log("Proxy returning result:", result.result ? "Success" : "Error");
        return NextResponse.json(result);
        
      } catch (err) {
        console.error(`RPC endpoint ${endpoint} failed:`, err);
        continue;
      }
    }

    return NextResponse.json(
      { 
        error: "All RPC endpoints failed",
        message: "Unable to connect to blockchain network. Please try again later.",
        endpoints_tried: RPC_ENDPOINTS 
      },
      { status: 503 }
    );
  } catch (err) {
    console.error("Proxy server error:", err);
    return NextResponse.json(
      { 
        error: "Proxy server error", 
        message: err instanceof Error ? err.message : String(err)
      },
      { status: 500 }
    );
  }
}

export const GET = POST;
