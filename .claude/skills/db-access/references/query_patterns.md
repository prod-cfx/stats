# 常用查询模式

本文档提供常见业务场景的 SQL 查询模板。

## 用户分析

### 用户统计

```sql
-- 用户总数
SELECT COUNT(*) FROM users;

-- 活跃用户数
SELECT COUNT(*) FROM users WHERE status = 'active';

-- 游客用户数
SELECT COUNT(*) FROM users WHERE is_guest = true;

-- 已验证邮箱的用户数
SELECT COUNT(*) FROM users WHERE email_verified = true;

-- 按状态分组统计
SELECT status, COUNT(*) as count
FROM users
GROUP BY status
ORDER BY count DESC;
```

### 用户增长趋势

```sql
-- 按日统计新增用户
SELECT
  DATE(created_at) as date,
  COUNT(*) as new_users
FROM users
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 按月统计新增用户
SELECT
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as new_users
FROM users
GROUP BY month
ORDER BY month DESC;
```

### 用户活跃度

```sql
-- 最近活跃的用户
SELECT id, email, nickname, last_active_at
FROM users
WHERE last_active_at IS NOT NULL
ORDER BY last_active_at DESC
LIMIT 20;

-- 30天内未活跃的用户
SELECT id, email, nickname, last_active_at
FROM users
WHERE last_active_at < NOW() - INTERVAL '30 days'
  OR last_active_at IS NULL
ORDER BY last_active_at DESC NULLS LAST
LIMIT 20;
```

## 邀请关系分析

### 邀请统计

```sql
-- 邀请人数最多的用户
SELECT
  inviter_id,
  COUNT(*) as invite_count
FROM invitation_relationships
GROUP BY inviter_id
ORDER BY invite_count DESC
LIMIT 10;

-- 邀请关系详情
SELECT
  ir.inviter_id,
  u1.nickname as inviter_name,
  ir.invitee_id,
  u2.nickname as invitee_name,
  ir.created_at
FROM invitation_relationships ir
JOIN users u1 ON ir.inviter_id = u1.id
JOIN users u2 ON ir.invitee_id = u2.id
ORDER BY ir.created_at DESC
LIMIT 20;
```

### 邀请码使用情况

```sql
-- 邀请码使用统计
SELECT
  code,
  user_id,
  usage_count,
  max_usage,
  is_active,
  expires_at
FROM invitation_codes
WHERE usage_count > 0
ORDER BY usage_count DESC
LIMIT 20;

-- 即将过期的邀请码
SELECT
  code,
  user_id,
  expires_at,
  usage_count,
  max_usage
FROM invitation_codes
WHERE expires_at > NOW()
  AND expires_at < NOW() + INTERVAL '7 days'
  AND is_active = true
ORDER BY expires_at ASC;
```

## 钱包和支付

### 钱包统计

```sql
-- 钱包余额前10的用户
SELECT
  user_id,
  balance,
  frozen_balance,
  (balance + frozen_balance) as total_balance
FROM wallets
ORDER BY total_balance DESC
LIMIT 10;

-- 总余额统计
SELECT
  COUNT(*) as wallet_count,
  SUM(balance) as total_balance,
  SUM(frozen_balance) as total_frozen,
  AVG(balance) as avg_balance
FROM wallets;

-- 余额分布
SELECT
  CASE
    WHEN balance = 0 THEN '0'
    WHEN balance < 10 THEN '0-10'
    WHEN balance < 50 THEN '10-50'
    WHEN balance < 100 THEN '50-100'
    WHEN balance < 500 THEN '100-500'
    ELSE '500+'
  END as balance_range,
  COUNT(*) as count
FROM wallets
GROUP BY balance_range
ORDER BY
  CASE balance_range
    WHEN '0' THEN 1
    WHEN '0-10' THEN 2
    WHEN '10-50' THEN 3
    WHEN '50-100' THEN 4
    WHEN '100-500' THEN 5
    ELSE 6
  END;
```

### 支付订单分析

```sql
-- 支付订单统计
SELECT
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM payment_orders
GROUP BY status;

-- 最近的支付订单
SELECT
  id,
  user_id,
  amount,
  status,
  payment_method,
  created_at
FROM payment_orders
ORDER BY created_at DESC
LIMIT 20;

-- 按日统计支付金额
SELECT
  DATE(created_at) as date,
  COUNT(*) as order_count,
  SUM(amount) as total_amount
FROM payment_orders
WHERE status = 'completed'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### 提现分析

```sql
-- 提现统计
SELECT
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM withdraw_requests
GROUP BY status;

-- 待处理的提现
SELECT
  id,
  user_id,
  amount,
  status,
  created_at
FROM withdraw_requests
WHERE status = 'pending'
ORDER BY created_at ASC;
```

## 角色(Character)分析

### 角色统计

```sql
-- 角色总数
SELECT COUNT(*) FROM characters;

-- 按可见性统计
SELECT visibility, COUNT(*) as count
FROM characters
GROUP BY visibility;

-- 最受欢迎的角色(按收藏数)
SELECT
  c.id,
  c.name,
  COUNT(cf.id) as favorite_count
FROM characters c
LEFT JOIN character_favorites cf ON c.id = cf.character_id
GROUP BY c.id, c.name
ORDER BY favorite_count DESC
LIMIT 10;

-- 最受欢迎的角色(按评分)
SELECT
  c.id,
  c.name,
  AVG(cr.score) as avg_score,
  COUNT(cr.id) as rating_count
FROM characters c
LEFT JOIN character_ratings cr ON c.id = cr.character_id
GROUP BY c.id, c.name
HAVING COUNT(cr.id) > 0
ORDER BY avg_score DESC, rating_count DESC
LIMIT 10;
```

### 角色使用统计

```sql
-- 使用次数最多的角色
SELECT
  c.id,
  c.name,
  cus.usage_count,
  cus.last_used_at
FROM character_usage_stats cus
JOIN characters c ON cus.character_id = c.id
ORDER BY cus.usage_count DESC
LIMIT 20;

-- 最近使用的角色
SELECT
  c.id,
  c.name,
  cus.usage_count,
  cus.last_used_at
FROM character_usage_stats cus
JOIN characters c ON cus.character_id = c.id
ORDER BY cus.last_used_at DESC
LIMIT 20;
```

## AI 用例分析

### 用例统计

```sql
-- AI 用例调用统计
SELECT
  usecase_name,
  COUNT(*) as call_count,
  AVG(response_time_ms) as avg_response_time,
  SUM(token_usage) as total_tokens
FROM ai_usecase_logs
GROUP BY usecase_name
ORDER BY call_count DESC;

-- 最近的 AI 用例调用
SELECT
  usecase_name,
  user_id,
  response_time_ms,
  token_usage,
  created_at
FROM ai_usecase_logs
ORDER BY created_at DESC
LIMIT 20;

-- 按日统计 AI 用例调用
SELECT
  DATE(created_at) as date,
  usecase_name,
  COUNT(*) as call_count,
  SUM(token_usage) as total_tokens
FROM ai_usecase_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), usecase_name
ORDER BY date DESC, call_count DESC;
```

## 活动(Activity)分析

### 活动定义

```sql
-- 所有活动
SELECT
  id,
  name,
  activity_type,
  status,
  start_time,
  end_time
FROM activity_definitions
ORDER BY start_time DESC;

-- 进行中的活动
SELECT
  id,
  name,
  activity_type,
  start_time,
  end_time
FROM activity_definitions
WHERE status = 'active'
  AND start_time <= NOW()
  AND (end_time IS NULL OR end_time >= NOW())
ORDER BY start_time DESC;
```

### 活动参与统计

```sql
-- 用户活动分数排行
SELECT
  user_id,
  activity_score,
  activity_updated_at
FROM users
WHERE activity_score > 0
ORDER BY activity_score DESC
LIMIT 20;
```

## 佣金分析

### 佣金统计

```sql
-- 佣金记录统计
SELECT
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM commission_records
GROUP BY status;

-- 收到佣金最多的用户
SELECT
  receiver_id,
  COUNT(*) as commission_count,
  SUM(amount) as total_commission
FROM commission_records
WHERE status = 'completed'
GROUP BY receiver_id
ORDER BY total_commission DESC
LIMIT 10;

-- 生成佣金最多的用户
SELECT
  generator_id,
  COUNT(*) as commission_count,
  SUM(amount) as total_commission
FROM commission_records
WHERE status = 'completed'
GROUP BY generator_id
ORDER BY total_commission DESC
LIMIT 10;
```

## 关联查询模式

### 用户完整信息

```sql
-- 用户及其钱包信息
SELECT
  u.id,
  u.email,
  u.nickname,
  w.balance,
  w.frozen_balance,
  u.created_at
FROM users u
LEFT JOIN wallets w ON u.walletId = w.id
WHERE u.id = '<user_id>';
```

### 多表联合统计

```sql
-- 用户全景数据
SELECT
  u.id,
  u.email,
  u.nickname,
  u.status,
  w.balance,
  COUNT(DISTINCT c.id) as character_count,
  COUNT(DISTINCT cf.id) as favorite_count,
  COUNT(DISTINCT ir.invitee_id) as invited_count
FROM users u
LEFT JOIN wallets w ON u.walletId = w.id
LEFT JOIN characters c ON c.user_id = u.id
LEFT JOIN character_favorites cf ON cf.user_id = u.id
LEFT JOIN invitation_relationships ir ON ir.inviter_id = u.id
WHERE u.id = '<user_id>'
GROUP BY u.id, u.email, u.nickname, u.status, w.balance;
```

## 数据质量检查

### 孤立数据检查

```sql
-- 没有钱包的用户
SELECT id, email, nickname
FROM users
WHERE walletId IS NULL
LIMIT 20;

-- 没有关联用户的角色
SELECT id, name, user_id
FROM characters
WHERE user_id NOT IN (SELECT id FROM users)
LIMIT 20;
```

### 异常数据检查

```sql
-- 负余额的钱包
SELECT id, user_id, balance, frozen_balance
FROM wallets
WHERE balance < 0 OR frozen_balance < 0;

-- 未来日期的数据
SELECT id, email, created_at
FROM users
WHERE created_at > NOW();

-- 邮箱重复的活跃用户
SELECT email, COUNT(*) as count
FROM users
WHERE deleted_at IS NULL
  AND email IS NOT NULL
GROUP BY email
HAVING COUNT(*) > 1;
```

## 性能优化建议

### 1. 使用索引字段过滤

```sql
-- ✅ 好: 使用索引字段
SELECT * FROM users WHERE email = 'test@example.com';

-- ❌ 差: 使用非索引字段
SELECT * FROM users WHERE bio LIKE '%keyword%';
```

### 2. 避免 SELECT \*

```sql
-- ✅ 好: 只选择需要的字段
SELECT id, email, nickname FROM users LIMIT 10;

-- ❌ 差: 选择所有字段
SELECT * FROM users LIMIT 10;
```

### 3. 使用 LIMIT

```sql
-- ✅ 好: 限制结果集
SELECT id, email FROM users ORDER BY created_at DESC LIMIT 100;

-- ❌ 差: 不限制结果集
SELECT id, email FROM users ORDER BY created_at DESC;
```

### 4. 避免 N+1 查询

```sql
-- ✅ 好: 使用 JOIN 一次查询
SELECT u.id, u.email, w.balance
FROM users u
LEFT JOIN wallets w ON u.walletId = w.id;

-- ❌ 差: 多次查询
-- SELECT * FROM users;
-- 然后对每个用户: SELECT * FROM wallets WHERE id = user.walletId;
```
