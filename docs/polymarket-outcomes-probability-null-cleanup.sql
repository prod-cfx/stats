-- Polymarket outcomes cleanup (SAFE-ish, optional)
--
-- 背景：我们现在约定“缺失 probability 的 outcome 不入库”。
-- 但历史库里可能已存在 probability=NULL 的 outcome，会导致前端 options 出现 '-'。
--
-- 方案：删除 polymarket_outcomes 中 probability IS NULL 的行。
--
-- 风险：
-- - 若其它表通过 outcome 的 DB id 建了外键（例如 orderbook snapshot），删除可能失败或造成引用断裂。
-- - 建议：先 dry-run 查数量，再根据实际外键约束选择 delete 或仅标记/重刷。

-- DRY RUN
select count(*) as would_delete
from polymarket_outcomes
where probability is null;

-- SAMPLE
select
  "outcomeTokenId",
  "marketId",
  probability,
  updated_at
from polymarket_outcomes
where probability is null
order by updated_at desc
limit 20;

-- APPLY (only if safe)
-- begin;
-- delete from polymarket_outcomes
-- where probability is null;
-- commit;
