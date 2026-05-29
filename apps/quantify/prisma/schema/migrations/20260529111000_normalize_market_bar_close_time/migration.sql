-- Normalize historical provider bars to the close-time contract used by rules-only runtime data.
-- Previous REST/selected WS adapters stored candle open time in market_bars.time. Runtime data
-- now treats market_bars.time / MarketBarPayload.timestamp as candle close time.

WITH shifted AS (
  SELECT
    id,
    symbol_id,
    timeframe,
    time,
    time + CASE timeframe::text
      WHEN '1m' THEN INTERVAL '1 minute'
      WHEN '3m' THEN INTERVAL '3 minutes'
      WHEN '5m' THEN INTERVAL '5 minutes'
      WHEN '15m' THEN INTERVAL '15 minutes'
      WHEN '30m' THEN INTERVAL '30 minutes'
      WHEN '1h' THEN INTERVAL '1 hour'
      WHEN '4h' THEN INTERVAL '4 hours'
      WHEN '6h' THEN INTERVAL '6 hours'
      WHEN '8h' THEN INTERVAL '8 hours'
      WHEN '12h' THEN INTERVAL '12 hours'
      WHEN '1d' THEN INTERVAL '1 day'
      WHEN '1w' THEN INTERVAL '1 week'
      ELSE INTERVAL '0 milliseconds'
    END AS shifted_time,
    ROW_NUMBER() OVER (
      PARTITION BY symbol_id,
        timeframe,
        time + CASE timeframe::text
          WHEN '1m' THEN INTERVAL '1 minute'
          WHEN '3m' THEN INTERVAL '3 minutes'
          WHEN '5m' THEN INTERVAL '5 minutes'
          WHEN '15m' THEN INTERVAL '15 minutes'
          WHEN '30m' THEN INTERVAL '30 minutes'
          WHEN '1h' THEN INTERVAL '1 hour'
          WHEN '4h' THEN INTERVAL '4 hours'
          WHEN '6h' THEN INTERVAL '6 hours'
          WHEN '8h' THEN INTERVAL '8 hours'
          WHEN '12h' THEN INTERVAL '12 hours'
          WHEN '1d' THEN INTERVAL '1 day'
          WHEN '1w' THEN INTERVAL '1 week'
          ELSE INTERVAL '0 milliseconds'
        END
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS duplicate_rank
  FROM market_bars
  WHERE source IN ('BINANCE_REST', 'OKX_REST', 'OKX_WS', 'HYPERLIQUID_REST', 'HYPERLIQUID_WS')
), duplicate_shifted AS (
  SELECT id
  FROM shifted
  WHERE duplicate_rank > 1
), conflicting_existing AS (
  SELECT shifted.id
  FROM shifted
  JOIN market_bars existing
    ON existing.symbol_id = shifted.symbol_id
    AND existing.timeframe = shifted.timeframe
    AND existing.time = shifted.shifted_time
    AND existing.id <> shifted.id
  WHERE shifted.duplicate_rank = 1
    AND existing.id NOT IN (SELECT id FROM shifted)
), rows_to_delete AS (
  SELECT id FROM duplicate_shifted
  UNION
  SELECT id FROM conflicting_existing
)
DELETE FROM market_bars
WHERE id IN (SELECT id FROM rows_to_delete);

UPDATE market_bars
SET
  time = time + CASE timeframe::text
    WHEN '1m' THEN INTERVAL '1 minute'
    WHEN '3m' THEN INTERVAL '3 minutes'
    WHEN '5m' THEN INTERVAL '5 minutes'
    WHEN '15m' THEN INTERVAL '15 minutes'
    WHEN '30m' THEN INTERVAL '30 minutes'
    WHEN '1h' THEN INTERVAL '1 hour'
    WHEN '4h' THEN INTERVAL '4 hours'
    WHEN '6h' THEN INTERVAL '6 hours'
    WHEN '8h' THEN INTERVAL '8 hours'
    WHEN '12h' THEN INTERVAL '12 hours'
    WHEN '1d' THEN INTERVAL '1 day'
    WHEN '1w' THEN INTERVAL '1 week'
    ELSE INTERVAL '0 milliseconds'
  END,
  updated_at = CURRENT_TIMESTAMP
WHERE source IN ('BINANCE_REST', 'OKX_REST', 'OKX_WS', 'HYPERLIQUID_REST', 'HYPERLIQUID_WS');
