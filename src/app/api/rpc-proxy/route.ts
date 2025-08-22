import { NextRequest, NextResponse } from "next/server";

const RPC_ENDPOINTS = [
  process.env.NEXT_PUBLIC_RPC_URL || "http://137.184.182.11:26657",
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    for (const endpoint of RPC_ENDPOINTS) {
      try {
        let response;
        if (body.jsonrpc) {
          // JSON-RPC request
          response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10000),
          });
        } else {
          // REST-style request
          const { path = "/status" } = body;
          const rpcUrl = `${endpoint}${path}`;
          response = await fetch(rpcUrl, {
            method: "GET",
            signal: AbortSignal.timeout(10000),
          });
        }

        if (!response.ok) continue;

        const result = await response.json();
        return NextResponse.json(result);
      } catch (err) {
        console.warn(`RPC endpoint ${endpoint} failed:`, err);
        continue;
      }
    }

    return NextResponse.json(
      { error: "All RPC endpoints failed", endpoints: RPC_ENDPOINTS },
      { status: 503 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Proxy server error", message: String(err) },
      { status: 500 }
    );
  }
}

export const GET = POST;
