-- Ensure aggregated orderbook hot-market configs exist during deploy.

WITH popular_bases(base_asset, ordinal) AS (
  VALUES
    ('SOL', 0),
    ('XRP', 1),
    ('DOGE', 2),
    ('BNB', 3),
    ('ADA', 4),
    ('LINK', 5),
    ('AVAX', 6)
),
cex_venues(venue, venue_ordinal) AS (
  VALUES
    ('BINANCE', 0),
    ('BYBIT', 1),
    ('BITMAX', 2),
    ('OKX', 3)
),
cex_instruments(instrument_type, instrument_ordinal) AS (
  VALUES
    ('SPOT', 0),
    ('PERPETUAL', 1)
),
rows AS (
  SELECT
    base_asset || 'USDT.' || venue || '.' || instrument_type AS pair_id,
    venue,
    CASE
      WHEN venue = 'BITMAX' AND instrument_type = 'SPOT' THEN base_asset || '/USDT'
      WHEN venue = 'BITMAX' AND instrument_type = 'PERPETUAL' THEN base_asset || '-PERP'
      WHEN venue = 'OKX' AND instrument_type = 'SPOT' THEN base_asset || '-USDT'
      WHEN venue = 'OKX' AND instrument_type = 'PERPETUAL' THEN base_asset || '-USDT-SWAP'
      ELSE base_asset || 'USDT'
    END AS symbol,
    base_asset,
    'USDT' AS quote_asset,
    'CEX' AS venue_type,
    instrument_type,
    true AS enabled,
    CASE WHEN base_asset = 'DOGE' THEN 200 ELSE 100 END AS depth_levels,
    CASE WHEN instrument_type = 'SPOT' THEN 5 ELSE 3 END AS pull_interval_seconds,
    200 + ordinal * 20 + venue_ordinal * 2 + instrument_ordinal AS priority,
    NULL::jsonb AS metadata,
    base_asset || '/USDT ' || lower(instrument_type) || ' orderbook on ' || venue AS description
  FROM popular_bases
  CROSS JOIN cex_venues
  CROSS JOIN cex_instruments
),
upserted AS (
  INSERT INTO orderbook_pair_configs (
    id,
    pair_id,
    venue,
    symbol,
    base_asset,
    quote_asset,
    venue_type,
    instrument_type,
    enabled,
    depth_levels,
    pull_interval_seconds,
    priority,
    metadata,
    description,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid()::text,
    pair_id,
    venue,
    symbol,
    base_asset,
    quote_asset,
    venue_type::"VenueType",
    instrument_type::"InstrumentType",
    enabled,
    depth_levels,
    pull_interval_seconds,
    priority,
    metadata,
    description,
    now(),
    now()
  FROM rows
  ON CONFLICT (pair_id) DO UPDATE SET
    symbol = EXCLUDED.symbol,
    base_asset = EXCLUDED.base_asset,
    quote_asset = EXCLUDED.quote_asset,
    venue_type = EXCLUDED.venue_type,
    instrument_type = EXCLUDED.instrument_type,
    enabled = EXCLUDED.enabled,
    depth_levels = EXCLUDED.depth_levels,
    pull_interval_seconds = EXCLUDED.pull_interval_seconds,
    priority = EXCLUDED.priority,
    metadata = EXCLUDED.metadata,
    description = EXCLUDED.description,
    updated_at = now()
  RETURNING 1
)
SELECT count(*) FROM upserted;

WITH rows(pair_id, venue, symbol, base_asset, quote_asset, venue_type, instrument_type, enabled, depth_levels, pull_interval_seconds, priority, metadata, description) AS (
  VALUES
    ('BTCUSDT.OKX.SPOT', 'OKX', 'BTC-USDT', 'BTC', 'USDT', 'CEX', 'SPOT', true, 100, 5, 50, NULL::jsonb, 'Bitcoin/USDT spot trading pair on OKX'),
    ('ETHUSDT.OKX.SPOT', 'OKX', 'ETH-USDT', 'ETH', 'USDT', 'CEX', 'SPOT', true, 100, 5, 60, NULL::jsonb, 'Ethereum/USDT spot trading pair on OKX'),
    ('BTCUSDT.OKX.PERPETUAL', 'OKX', 'BTC-USDT-SWAP', 'BTC', 'USDT', 'CEX', 'PERPETUAL', true, 100, 3, 55, NULL::jsonb, 'Bitcoin/USDT perpetual contract on OKX'),
    ('ETHUSDT.OKX.PERPETUAL', 'OKX', 'ETH-USDT-SWAP', 'ETH', 'USDT', 'CEX', 'PERPETUAL', true, 100, 3, 65, NULL::jsonb, 'Ethereum/USDT perpetual contract on OKX')
)
INSERT INTO orderbook_pair_configs (
  id, pair_id, venue, symbol, base_asset, quote_asset, venue_type, instrument_type,
  enabled, depth_levels, pull_interval_seconds, priority, metadata, description, created_at, updated_at
)
SELECT
  gen_random_uuid()::text,
  pair_id,
  venue,
  symbol,
  base_asset,
  quote_asset,
  venue_type::"VenueType",
  instrument_type::"InstrumentType",
  enabled,
  depth_levels,
  pull_interval_seconds,
  priority,
  metadata,
  description,
  now(),
  now()
FROM rows
ON CONFLICT (pair_id) DO UPDATE SET
  symbol = EXCLUDED.symbol,
  enabled = EXCLUDED.enabled,
  depth_levels = EXCLUDED.depth_levels,
  pull_interval_seconds = EXCLUDED.pull_interval_seconds,
  priority = EXCLUDED.priority,
  description = EXCLUDED.description,
  updated_at = now();

WITH rows(base_asset, depth_levels, priority) AS (
  VALUES
    ('SOL', 100, 120),
    ('XRP', 100, 221),
    ('DOGE', 200, 241),
    ('BNB', 100, 261),
    ('ADA', 100, 281),
    ('LINK', 100, 301),
    ('AVAX', 100, 321),
    ('HYPE', 100, 400)
)
INSERT INTO orderbook_pair_configs (
  id, pair_id, venue, symbol, base_asset, quote_asset, venue_type, instrument_type,
  enabled, depth_levels, pull_interval_seconds, priority, metadata, description, created_at, updated_at
)
SELECT
  gen_random_uuid()::text,
  base_asset || 'USDT.HYPERLIQUID.PERPETUAL',
  'HYPERLIQUID',
  base_asset || 'USDT',
  base_asset,
  'USDT',
  'DEX'::"VenueType",
  'PERPETUAL'::"InstrumentType",
  true,
  depth_levels,
  1,
  priority,
  NULL::jsonb,
  base_asset || '/USDT perpetual contract on Hyperliquid DEX',
  now(),
  now()
FROM rows
ON CONFLICT (pair_id) DO UPDATE SET
  symbol = EXCLUDED.symbol,
  enabled = EXCLUDED.enabled,
  depth_levels = EXCLUDED.depth_levels,
  pull_interval_seconds = EXCLUDED.pull_interval_seconds,
  priority = EXCLUDED.priority,
  description = EXCLUDED.description,
  updated_at = now();

WITH rows(pair_id, symbol, base_asset, quote_asset, priority, metadata, description) AS (
  VALUES
    ('HYPE/USDC.HYPERLIQUID.SPOT', 'HYPE/USDC', 'HYPE', 'USDC', 125, '{"spotIndex":107}'::jsonb, 'HYPE/USDC spot trading pair on Hyperliquid DEX'),
    ('PURR/USDC.HYPERLIQUID.SPOT', 'PURR/USDC', 'PURR', 'USDC', 130, NULL::jsonb, 'PURR/USDC spot trading pair on Hyperliquid DEX'),
    ('BTC/USDC.HYPERLIQUID.SPOT', 'BTC/USDC', 'BTC', 'USDC', 140, '{"spotIndex":142}'::jsonb, 'BTC/USDC spot trading pair on Hyperliquid DEX'),
    ('ETH/USDC.HYPERLIQUID.SPOT', 'ETH/USDC', 'ETH', 'USDC', 141, '{"spotIndex":151}'::jsonb, 'ETH/USDC spot trading pair on Hyperliquid DEX'),
    ('SOL/USDC.HYPERLIQUID.SPOT', 'SOL/USDC', 'SOL', 'USDC', 142, '{"spotIndex":156}'::jsonb, 'SOL/USDC spot trading pair on Hyperliquid DEX'),
    ('USDT/USDC.HYPERLIQUID.SPOT', 'USDT/USDC', 'USDT', 'USDC', 143, '{"spotIndex":166}'::jsonb, 'USDT/USDC spot trading pair on Hyperliquid DEX'),
    ('XPL/USDC.HYPERLIQUID.SPOT', 'XPL/USDC', 'XPL', 'USDC', 144, '{"spotIndex":210}'::jsonb, 'XPL/USDC spot trading pair on Hyperliquid DEX'),
    ('USDH/USDC.HYPERLIQUID.SPOT', 'USDH/USDC', 'USDH', 'USDC', 145, '{"spotIndex":230}'::jsonb, 'USDH/USDC spot trading pair on Hyperliquid DEX'),
    ('KNTQ/USDC.HYPERLIQUID.SPOT', 'KNTQ/USDC', 'KNTQ', 'USDC', 146, '{"spotIndex":334}'::jsonb, 'KNTQ/USDC spot trading pair on Hyperliquid DEX'),
    ('ZEC/USDC.HYPERLIQUID.SPOT', 'ZEC/USDC', 'ZEC', 'USDC', 147, '{"spotIndex":272}'::jsonb, 'ZEC/USDC spot trading pair on Hyperliquid DEX')
)
INSERT INTO orderbook_pair_configs (
  id, pair_id, venue, symbol, base_asset, quote_asset, venue_type, instrument_type,
  enabled, depth_levels, pull_interval_seconds, priority, metadata, description, created_at, updated_at
)
SELECT
  gen_random_uuid()::text,
  pair_id,
  'HYPERLIQUID',
  symbol,
  base_asset,
  quote_asset,
  'DEX'::"VenueType",
  'SPOT'::"InstrumentType",
  true,
  100,
  1,
  priority,
  metadata,
  description,
  now(),
  now()
FROM rows
ON CONFLICT (pair_id) DO UPDATE SET
  symbol = EXCLUDED.symbol,
  base_asset = EXCLUDED.base_asset,
  quote_asset = EXCLUDED.quote_asset,
  enabled = EXCLUDED.enabled,
  depth_levels = EXCLUDED.depth_levels,
  pull_interval_seconds = EXCLUDED.pull_interval_seconds,
  priority = EXCLUDED.priority,
  metadata = EXCLUDED.metadata,
  description = EXCLUDED.description,
  updated_at = now();
