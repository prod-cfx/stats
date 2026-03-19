-- Add i18n fields to polymarket_markets
ALTER TABLE "polymarket_markets" ADD COLUMN IF NOT EXISTS "eventTitleZh" TEXT;
ALTER TABLE "polymarket_markets" ADD COLUMN IF NOT EXISTS "questionZh" TEXT;

-- Add i18n fields to polymarket_outcomes
ALTER TABLE "polymarket_outcomes" ADD COLUMN IF NOT EXISTS "nameZh" TEXT;
ALTER TABLE "polymarket_outcomes" ADD COLUMN IF NOT EXISTS "shortNameZh" TEXT;
