WITH ranked_accounts AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, exchange_id
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM "public"."exchange_accounts"
)
DELETE FROM "public"."exchange_accounts" ea
USING ranked_accounts ra
WHERE ea.id = ra.id
  AND ra.rn > 1;

DROP INDEX IF EXISTS "public"."uniq_exchange_accounts_user_exchange_name";
CREATE UNIQUE INDEX "uniq_exchange_accounts_user_exchange"
  ON "public"."exchange_accounts"("user_id" ASC, "exchange_id" ASC);
