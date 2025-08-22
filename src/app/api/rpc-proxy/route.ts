// Next.js API route to proxy RPC requests for production
// This helps bypass CORS and mixed content issues

import { NextRequest, NextResponse } from 'next/server';

const RPC_ENDPOINTS = [
  process.env.NEXT_PUBLIC_RPC_URL || "http://137.184.182.11:26657",
  "http://137.184.182.11:26657"
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { method, path, data } = body;
    
    // Try each RPC endpoint
    for (const endpoint of RPC_ENDPOINTS) {
      try {
        const rpcUrl = `${endpoint}${path || '/status'}`;
        console.log(`Proxying request to: ${rpcUrl}`);
        
        const response = await fetch(rpcUrl, {
          method: method || 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          body: data ? JSON.stringify(data) : undefined,
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        if (!response.ok) {
          console.warn(`RPC endpoint ${endpoint} returned ${response.status}`);
          continue;
        }
        
        const result = await response.json();
        return NextResponse.json(result);
        
      } catch (error) {
        console.warn(`RPC endpoint ${endpoint} failed:`, error);
        continue;
      }
    }
    
    return NextResponse.json(
      { 
        error: 'All RPC endpoints failed',
        message: 'Unable to connect to blockchain network. Please try again later.',
        endpoints_tried: RPC_ENDPOINTS
      },
      { status: 503 }
    );
    
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { 
        error: 'Proxy server error', 
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
