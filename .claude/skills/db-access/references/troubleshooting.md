# 故障排除指南

## 连接问题

### 问题: 连接超时或拒绝

**症状**:

```
psql: error: connection to server at "localhost" (::1), port 5432 failed: Connection refused
```

**解决方案**:

1. 检查 PostgreSQL 服务是否运行:

```bash
pg_isready -h localhost -p 5432
```

2. 如果服务未运行,启动服务:

```bash
# macOS (Homebrew)
brew services start postgresql@14

# Linux (systemd)
sudo systemctl start postgresql

# 或使用 pg_ctl
pg_ctl -D /path/to/data start
```

3. 检查服务监听端口:

```bash
netstat -an | grep 5432
# 或
lsof -i :5432
```

### 问题: 密码认证失败

**症状**:

```
psql: error: connection to server at "localhost", port 5432 failed: fe_sendauth: no password supplied
```

**解决方案**:

1. 确认使用了 `PGPASSWORD` 环境变量:

```bash
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "\dt"
```

2. 检查 `.env.development.local` 中的密码:

```bash
grep POSTGRES_PASSWORD /Users/a1/work/ai_monorepo_main/.env.development.local
```

3. 验证数据库用户密码:

```bash
# 以超级用户身份连接(不需要密码的方式,如 peer 认证)
psql -U postgres

# 在 psql 中修改密码
ALTER USER postgres PASSWORD 'postgres';
```

### 问题: 数据库不存在

**症状**:

```
psql: error: connection to server at "localhost", port 5432 failed: FATAL:  database "ai_dev" does not exist
```

**解决方案**:

1. 列出所有数据库:

```bash
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d postgres -c "\l"
```

2. 创建数据库(如果不存在):

```bash
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d postgres -c "CREATE DATABASE ai_dev;"
```

3. 运行 Prisma 迁移初始化数据库:

```bash
cd /Users/a1/work/ai_monorepo_main
./scripts/dx db migrate --dev
```

## 查询问题

### 问题: 表不存在

**症状**:

```
ERROR:  relation "table_name" does not exist
```

**解决方案**:

1. 检查表名大小写(PostgreSQL 区分大小写):

```bash
# 列出所有表
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "\dt"
```

2. 检查是否在正确的 schema:

```bash
# 列出所有 schema
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "\dn"

# 查看表的完整路径
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "SELECT schemaname, tablename FROM pg_tables WHERE tablename = 'table_name';"
```

3. 如果表名包含大写字母或特殊字符,使用双引号:

```bash
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c 'SELECT * FROM "TableName" LIMIT 1;'
```

### 问题: 字段不存在

**症状**:

```
ERROR:  column "column_name" does not exist
```

**解决方案**:

1. 检查字段名:

```bash
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "\d table_name"
```

2. 查看 Prisma schema 定义:

```bash
cat /Users/a1/work/ai_monorepo_main/apps/backend/prisma/schema/*.prisma | grep -A 20 "model TableName"
```

3. 注意字段名的映射(Prisma 的 `@map`):

```prisma
// Prisma schema
emailVerified Boolean @map("email_verified")

// SQL 查询应使用
SELECT email_verified FROM users;  // ✅ 正确
// 而不是
SELECT emailVerified FROM users;   // ❌ 错误
```

### 问题: 语法错误

**症状**:

```
ERROR:  syntax error at or near "..."
```

**解决方案**:

1. 检查 SQL 语句完整性:
   - 确保所有引号成对
   - 确保圆括号匹配
   - 确保分号正确使用

2. 在 psql 命令中使用单引号包裹 SQL:

```bash
# ✅ 正确
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "SELECT * FROM users WHERE email = 'test@example.com';"

# ❌ 错误(双引号冲突)
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "SELECT * FROM users WHERE email = "test@example.com";"
```

3. 复杂查询使用 heredoc:

```bash
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev <<EOF
SELECT
  u.id,
  u.email,
  w.balance
FROM users u
LEFT JOIN wallets w ON u.walletId = w.id
WHERE u.email = 'test@example.com';
EOF
```

## 输出问题

### 问题: 输出过多导致卡顿

**解决方案**:

1. 使用 `LIMIT` 限制结果集:

```bash
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "SELECT * FROM users LIMIT 10;"
```

2. 使用 `head` 限制输出行数:

```bash
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "\dt" | head -20
```

3. 先使用 `COUNT(*)` 统计数量:

```bash
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "SELECT COUNT(*) FROM users;"
```

4. 只选择必要的字段:

```bash
# ✅ 好
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "SELECT id, email FROM users LIMIT 100;"

# ❌ 差
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "SELECT * FROM users LIMIT 100;"
```

### 问题: 输出乱码或格式混乱

**解决方案**:

1. 确保终端编码为 UTF-8:

```bash
export LC_ALL=en_US.UTF-8
```

2. 使用扩展显示模式(适合宽表):

```bash
# 在 psql 交互模式中
\x
SELECT * FROM users LIMIT 1;
```

## 性能问题

### 问题: 查询速度慢

**解决方案**:

1. 使用 `EXPLAIN ANALYZE` 分析查询:

```bash
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';"
```

2. 检查是否使用了索引:

```bash
# 查看表的索引
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "\d+ users"
```

3. 添加合适的索引(通过 Prisma migration):

```prisma
// 在 schema.prisma 中
model User {
  email String?

  @@index([email])  // 添加索引
}
```

4. 避免全表扫描:

```bash
# ❌ 差: 全表扫描
SELECT * FROM users WHERE bio LIKE '%keyword%';

# ✅ 好: 使用索引
SELECT * FROM users WHERE email = 'test@example.com';
```

### 问题: 锁等待或死锁

**症状**:

```
ERROR:  deadlock detected
```

**解决方案**:

1. 查看当前锁:

```bash
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "SELECT pid, usename, query FROM pg_stat_activity WHERE datname = 'ai_dev';"
```

2. 查找阻塞查询:

```bash
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "SELECT blocked_locks.pid AS blocked_pid, blocking_locks.pid AS blocking_pid, blocked_activity.query AS blocked_statement FROM pg_catalog.pg_locks blocked_locks JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype WHERE NOT blocked_locks.granted;"
```

3. 终止阻塞进程(谨慎使用):

```bash
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "SELECT pg_terminate_backend(<pid>);"
```

## Schema 问题

### 问题: Prisma schema 与数据库不一致

**解决方案**:

1. 检查待应用的迁移:

```bash
cd /Users/a1/work/ai_monorepo_main
./scripts/dx db migrate status
```

2. 应用所有迁移:

```bash
./scripts/dx db migrate --dev
```

3. 如果迁移失败,检查数据库状态:

```bash
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10;"
```

4. 重新生成 Prisma Client:

```bash
./scripts/dx db generate
```

### 问题: 找不到某个模型的 schema 文件

**解决方案**:

1. 列出所有 schema 文件:

```bash
ls /Users/a1/work/ai_monorepo_main/apps/backend/prisma/schema/
```

2. 搜索包含特定模型的文件:

```bash
grep -l "model User" /Users/a1/work/ai_monorepo_main/apps/backend/prisma/schema/*.prisma
```

3. 搜索字段定义:

```bash
grep -n "email" /Users/a1/work/ai_monorepo_main/apps/backend/prisma/schema/user.prisma
```

## 环境问题

### 问题: 环境变量未加载

**解决方案**:

1. 检查 `.env.development.local` 文件是否存在:

```bash
ls -la /Users/a1/work/ai_monorepo_main/.env.development.local
```

2. 验证数据库连接字符串:

```bash
grep DATABASE_URL /Users/a1/work/ai_monorepo_main/.env.development.local
```

3. 确认环境变量格式正确:

```bash
# 正确格式
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_dev
```

## 数据一致性问题

### 问题: 数据完整性约束违反

**症状**:

```
ERROR:  duplicate key value violates unique constraint
ERROR:  violates foreign key constraint
```

**解决方案**:

1. 检查唯一约束:

```bash
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "\d+ table_name"
```

2. 查找重复数据:

```bash
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "SELECT column_name, COUNT(*) FROM table_name GROUP BY column_name HAVING COUNT(*) > 1;"
```

3. 检查外键关系:

```bash
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='table_name';"
```

## 常见错误代码

| 错误代码 | 含义         | 解决方案               |
| -------- | ------------ | ---------------------- |
| 42P01    | 表不存在     | 检查表名,运行迁移      |
| 42703    | 字段不存在   | 检查字段名,查看 schema |
| 23505    | 唯一约束违反 | 检查重复数据           |
| 23503    | 外键约束违反 | 检查关联数据是否存在   |
| 23502    | 非空约束违反 | 提供必需字段的值       |
| 42601    | 语法错误     | 检查 SQL 语句语法      |
| 08006    | 连接失败     | 检查数据库服务,网络    |

## 紧急恢复

### 场景: 数据库崩溃或损坏

**恢复步骤**:

1. 停止应用服务
2. 检查 PostgreSQL 日志:

```bash
# macOS (Homebrew)
tail -f /opt/homebrew/var/log/postgresql@14.log

# Linux
tail -f /var/log/postgresql/postgresql-14-main.log
```

3. 尝试重启 PostgreSQL:

```bash
brew services restart postgresql@14
```

4. 如果无法恢复,从备份恢复(如果有)

5. 最坏情况下,重置数据库:

```bash
./scripts/dx db reset --dev
./scripts/dx db seed --dev
```

## 获取帮助

### 查看帮助文档

```bash
# psql 帮助
psql --help

# psql 内部命令帮助
\?

# SQL 命令帮助
\h SELECT
```

### 启用详细输出

```bash
# 显示执行时间
\timing on

# 显示详细错误信息
\set VERBOSITY verbose
```
