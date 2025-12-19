import { NextResponse } from "next/server";

const HYPERLIQUID_API = "https://api.hyperliquid.xyz/info";

export async function GET() {
  try {
    const response = await fetch(HYPERLIQUID_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "l2Book", coin: "HYPE" }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch order book: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching HYPE order book:", error);
    return NextResponse.json(
      { error: "Failed to fetch order book", levels: [[], []] },
      { status: 500 }
    );
  }
}
