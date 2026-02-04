-- Polymarket probability cleanup (SAFE, optional)
--
-- 目标：仅在“高度可疑的历史兜底写 0”场景下，将 polymarket_outcomes.probability 从 0 置为 NULL。
--
-- 强约束（避免误伤真实 0）：
-- - probability = 0
-- - price 为空或 0
-- - rawPayload 不包含任何可能的来源字段（probability/price/outcomePrice/outcome_price）
--
-- 使用方式：
-- 1) 先跑 DRY RUN 查看影响行数；确认合理后再执行 UPDATE。
-- 2) 建议在事务中执行，并在执行前做备份/快照。

-- DRY RUN: count rows that would be updated
select
  count(*) as would_update
from polymarket_outcomes
where probability = 0
  and (price is null or price = 0)
  and (
    "rawPayload" is null
    or (
      not ("rawPayload" ? 'probability')
      and not ("rawPayload" ? 'price')
      and not ("rawPayload" ? 'outcomePrice')
      and not ("rawPayload" ? 'outcome_price')
    )
  );

-- APPLY: set suspect probability=0 to NULL
-- begin;
-- update polymarket_outcomes
-- set probability = null
-- where probability = 0
--   and (price is null or price = 0)
--   and (
--     "rawPayload" is null
--     or (
--       not ("rawPayload" ? 'probability')
--       and not ("rawPayload" ? 'price')
--       and not ("rawPayload" ? 'outcomePrice')
--       and not ("rawPayload" ? 'outcome_price')
--     )
--   );
-- commit;
