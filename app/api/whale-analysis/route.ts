import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [liquidationRes, longShortRes] = await Promise.all([
      fetch('https://hyperbot.network/api/whales/coin-liquidation?coin=HYPE&interval=24h', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }),
      fetch('https://hyperbot.network/api/whales/long-short?coin=HYPE', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })
    ]);

    if (!liquidationRes.ok || !longShortRes.ok) {
        throw new Error(`External API error: ${liquidationRes.status} ${longShortRes.status}`);
    }

    const liquidationData = await liquidationRes.json();
    const longShortData = await longShortRes.json();

    return NextResponse.json({
      liquidation: liquidationData.data || { longUsd: 0, shortUsd: 0 },
      longShort: longShortData.data || { longCount: 0, shortCount: 0 }
    });

  } catch (error) {
    console.error('Error fetching whale data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch whale data' },
      { status: 500 }
    );
  }
}
