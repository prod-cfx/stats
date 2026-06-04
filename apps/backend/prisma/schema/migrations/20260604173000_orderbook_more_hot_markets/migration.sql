-- Extend aggregated orderbook hot-market configs. The previous hot-market migration
-- may already be applied in staging, so this migration only upserts incremental bases.

WITH popular_bases(base_asset, ordinal) AS (
  VALUES
    ('LTC', 0),
    ('BCH', 1),
    ('DOT', 2),
    ('TRX', 3),
    ('TON', 4),
    ('SUI', 5),
    ('AAVE', 6),
    ('UNI', 7),
    ('NEAR', 8),
    ('ARB', 9),
    ('OP', 10),
    ('APT', 11),
    ('ETC', 12),
    ('FIL', 13),
    ('INJ', 14),
    ('ATOM', 15),
    ('SEI', 16),
    ('WIF', 17),
    ('ENA', 18)
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
cex_rows AS (
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
    100 AS depth_levels,
    CASE WHEN instrument_type = 'SPOT' THEN 5 ELSE 3 END AS pull_interval_seconds,
    500 + ordinal * 20 + venue_ordinal * 2 + instrument_ordinal AS priority,
    NULL::jsonb AS metadata,
    base_asset || '/USDT ' || lower(instrument_type) || ' orderbook on ' || venue AS description
  FROM popular_bases
  CROSS JOIN cex_venues
  CROSS JOIN cex_instruments
),
hyperliquid_perp_rows AS (
  SELECT
    base_asset || 'USDT.HYPERLIQUID.PERPETUAL' AS pair_id,
    'HYPERLIQUID' AS venue,
    base_asset || 'USDT' AS symbol,
    base_asset,
    'USDT' AS quote_asset,
    'DEX' AS venue_type,
    'PERPETUAL' AS instrument_type,
    true AS enabled,
    100 AS depth_levels,
    1 AS pull_interval_seconds,
    500 + ordinal * 20 + 8 AS priority,
    NULL::jsonb AS metadata,
    base_asset || '/USDT perpetual contract on Hyperliquid DEX' AS description
  FROM popular_bases
),
rows AS (
  SELECT * FROM cex_rows
  UNION ALL
  SELECT * FROM hyperliquid_perp_rows
)
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
  updated_at = now();
