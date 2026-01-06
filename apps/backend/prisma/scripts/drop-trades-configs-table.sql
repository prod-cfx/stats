-- 删除 trades_pair_configs 表和相关迁移记录

-- 1. 删除 trades_pair_configs 表
DROP TABLE IF EXISTS "trades_pair_configs" CASCADE;

-- 2. 删除相关的迁移记录
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20260106102043_add_trades_pair_configs';

-- 完成
SELECT 'trades_pair_configs 表已删除，迁移记录已清除' AS status;
