create table if not exists simulated_positions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  entry_price numeric not null,
  direction text not null, -- 'BUY' or 'SELL'
  status text default 'OPEN', -- 'OPEN', 'CLOSED_TP', 'CLOSED_SL'
  amount_usd numeric default 1000,
  leverage numeric default 5,
  close_price numeric,
  pnl_percent numeric,
  trigger_id text unique, -- Unique ID to prevent duplicate positions (e.g., 'twap_123' or 'dense_time_side')
  end_time timestamptz -- When the triggering TWAP order ends
);
