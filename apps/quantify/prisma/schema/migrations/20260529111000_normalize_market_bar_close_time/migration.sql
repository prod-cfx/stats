-- Intentionally no-op.
--
-- The original version of this migration tried to rewrite historical market_bars.time
-- values from candle open time to candle close time during deploy. On real datasets that
-- can hold the release lock for too long and fail the prisma-migrate phase.
--
-- Runtime compatibility now handles legacy open-time rows in application code, while new
-- provider writes use versioned *_CLOSE_TIME sources. Keep this migration lightweight so
-- failed deploys can recover without a long data rewrite in the release path.
SELECT 1;
