# HYPE Monitor Dashboard

A high-performance, real-time monitoring dashboard designed for the HYPE token on Hyperliquid. This tool provides deep insights into whale activity, TWAP orders, and liquidation risks.

## 🚀 Features

- **Whale Analysis**: Real-time tracking of liquidation values (1D) and current long/short counts for the HYPE token.
- **Active HYPE TWAPs**: Live monitoring of on-chain TWAP orders. Includes:
  - **Large Order Alerts**: Instant toast notifications and voice alerts (text-to-speech) for orders > $500k.
  - **Progress Tracking**: Visual progress bars and time-remaining estimates for active orders.
- **Whale Positions Table**: In-depth view of the top 50 largest open positions.
  - **Advanced Filtering**: Filter by side (Long/Short) and unrealized PnL (Profit/Loss).
  - **Live Stats**: Aggregated statistics for total longs and shorts in the current view.
- **Liquidation Map**: Visual representation of HYPE liquidation price levels and impact.
- **Premium UI/UX**:
  - Glassmorphism design with a sleek dark-mode aesthetic.
  - Responsive layout for desktop and mobile viewing.
  - Real-time auto-refresh with status indicators.

## 🛠 Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Notifications**: [Sonner](https://tonydinh.com/sonner)
- **Voice**: Web Speech API for real-time Chinese voice alerts.
- **Data Sources**: Aggregated via server-side API proxies from **HypurrScan** and **Hyperbot**.

## 🛠 Getting Started

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🔗 Links

- **Developer**: [GitHub/Bot80926](https://github.com/Bot80926)
- **Data Providers**: [HypurrScan](https://hypurrscan.io/), [Hyperbot](https://hyperbot.network/)
