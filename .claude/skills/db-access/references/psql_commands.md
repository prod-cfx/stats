# psql 命令完整参考

## 元命令 (Meta Commands)

### 表相关

```bash
# 列出所有表
\dt

# 列出所有表(带详细信息)
\dt+

# 查看表结构(简要)
\d <table_name>

# 查看表结构(详细: 包含存储、压缩、索引、约束、外键)
\d+ <table_name>

# 查看表的索引
\di <table_name>*
```

### Schema 相关

```bash
# 列出所有 schema
\dn

# 列出所有 schema(带详细信息)
\dn+
```

### 索引相关

```bash
# 列出所有索引
\di

# 列出特定表的索引
\di <table_name>*
```

### 视图相关

```bash
# 列出所有视图
\dv

# 查看视图定义
\d+ <view_name>
```

### 函数相关

```bash
# 列出所有函数
\df

# 列出所有聚合函数
\da
```

### 用户和权限

```bash
# 列出所有用户
\du

# 列出所有角色
\dg
```

### 数据库相关

```bash
# 列出所有数据库
\l

# 列出所有数据库(带详细信息)
\l+
```

### 其他常用

```bash
# 查看所有枚举类型
\dT

# 查看表空间
\db

# 显示执行时间
\timing

# 查看当前连接信息
\conninfo

# 退出
\q
```

## SQL 查询语句

### 信息查询

```bash
# 获取所有表名
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

# 获取表字段信息
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = '<table_name>'
ORDER BY ordinal_position;

# 获取外键关系
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name='<table_name>';

# 获取表的主键
SELECT a.attname
FROM pg_index i
JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
WHERE i.indrelid = '<table_name>'::regclass AND i.indisprimary;

# 获取表的唯一约束
SELECT conname, contype, conkey
FROM pg_constraint
WHERE conrelid = '<table_name>'::regclass AND contype = 'u';
```

### 统计查询

```bash
# 数据库大小
SELECT pg_size_pretty(pg_database_size('ai_dev'));

# 所有表的大小(按大小排序)
SELECT
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS size,
  pg_size_pretty(pg_relation_size(relid)) AS table_size,
  pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;

# 表记录数统计
SELECT
  schemaname,
  relname AS table_name,
  n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

# 表的死元组统计(用于判断是否需要 VACUUM)
SELECT
  schemaname,
  tablename,
  n_live_tup,
  n_dead_tup,
  round(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_ratio
FROM pg_stat_user_tables
WHERE n_dead_tup > 0
ORDER BY n_dead_tup DESC;
```

### 性能相关

```bash
# 查看未使用的索引
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE '%pkey'
ORDER BY pg_relation_size(indexrelid) DESC;

# 查看索引使用频率
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC
LIMIT 20;

# 查看表的顺序扫描统计
SELECT
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  n_live_tup
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_scan DESC
LIMIT 20;

# 查看慢查询(需要启用 pg_stat_statements)
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 连接和锁

```bash
# 查看当前连接
SELECT pid, usename, application_name, client_addr, state, query
FROM pg_stat_activity
WHERE datname = 'ai_dev';

# 查看锁信息
SELECT
  l.pid,
  l.locktype,
  l.mode,
  l.granted,
  a.query
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE a.datname = 'ai_dev';

# 查看阻塞查询
SELECT
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

## 输出格式控制

```bash
# 切换到扩展显示模式(垂直显示)
\x

# 切换回正常模式
\x

# 设置分页器
\pset pager off  # 关闭分页
\pset pager on   # 开启分页

# 设置输出格式
\pset format aligned     # 对齐格式(默认)
\pset format unaligned   # 不对齐
\pset format wrapped     # 自动换行
\pset format html        # HTML 格式
\pset format csv         # CSV 格式
```

## 使用技巧

### 1. 限制输出

```bash
# 方法1: SQL LIMIT
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "SELECT * FROM users LIMIT 10;"

# 方法2: head 管道
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "\dt" | head -20

# 方法3: 组合使用
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "SELECT * FROM users LIMIT 100;" | head -30
```

### 2. 错误处理

```bash
# 捕获所有输出(包括错误)
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "SELECT * FROM non_existent_table;" 2>&1
```

### 3. 多语句执行

```bash
# 使用分号分隔
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM characters;"
```

### 4. 导出数据

```bash
# 导出为 CSV
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "\copy (SELECT * FROM users) TO '/tmp/users.csv' WITH CSV HEADER;"

# 导出为 JSON(需要 PostgreSQL 9.3+)
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "SELECT json_agg(users) FROM users;" > /tmp/users.json
```

## 性能优化建议

### 1. 使用 EXPLAIN 分析查询

```bash
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';"
```

### 2. 检查索引覆盖

```bash
# 查看查询计划是否使用了索引
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "EXPLAIN SELECT * FROM users WHERE email = 'test@example.com';"
```

### 3. 批量操作优化

```bash
# 使用 COPY 而不是 INSERT(大批量数据)
\copy table_name FROM '/path/to/file.csv' WITH CSV HEADER;
```
