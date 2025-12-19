import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch('https://hyperbot.network/api/whales/open-positions?take=50&coin=HYPE&dir=all&npnl-side=all&fr-side=all&top-by=create-time', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
        throw new Error(`External API error: ${res.status}`);
    }

    const data = await res.json();

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching whale positions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch whale positions' },
      { status: 500 }
    );
  }
}
