#!/bin/bash

# 聚合交易量功能验证脚本
# 用途：验证数据库、API 端点和前端集成是否正常工作

set -e

echo "========================================"
echo "聚合交易量功能验证脚本"
echo "========================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 数据库连接信息（从环境变量读取）
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_NAME="${DATABASE_NAME:-coinflux}"
DB_USER="${DATABASE_USER:-postgres}"

# API 端点
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"

# 验证函数
verify_step() {
    local step_name=$1
    local command=$2

    echo -n "检查 $step_name... "

    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 通过${NC}"
        return 0
    else
        echo -e "${RED}✗ 失败${NC}"
        return 1
    fi
}

# 步骤 1: 检查数据库连接
echo "步骤 1: 验证数据库连接"
echo "----------------------------------------"

if command -v psql > /dev/null 2>&1; then
    if PGPASSWORD="${DATABASE_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 数据库连接成功${NC}"
    else
        echo -e "${RED}✗ 数据库连接失败${NC}"
        echo -e "${YELLOW}提示：请确保 PostgreSQL 正在运行，并检查连接信息${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ psql 未安装，跳过数据库连接检查${NC}"
fi
echo ""

# 步骤 2: 检查数据库表
echo "步骤 2: 验证数据库表"
echo "----------------------------------------"

if command -v psql > /dev/null 2>&1; then
    TABLE_EXISTS=$(PGPASSWORD="${DATABASE_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'aggregated_volumes');" 2>/dev/null || echo "false")

    if [ "$TABLE_EXISTS" = "t" ]; then
        echo -e "${GREEN}✓ aggregated_volumes 表已存在${NC}"

        # 检查表结构
        echo "  检查表结构："
        COLUMNS=$(PGPASSWORD="${DATABASE_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT column_name FROM information_schema.columns WHERE table_name = 'aggregated_volumes' ORDER BY ordinal_position;" 2>/dev/null)

        REQUIRED_COLUMNS=("id" "exchange" "symbol" "instrument_type" "volume_usd" "data_timestamp" "source" "created_at" "updated_at")
        for col in "${REQUIRED_COLUMNS[@]}"; do
            if echo "$COLUMNS" | grep -q "^$col$"; then
                echo -e "    ${GREEN}✓${NC} $col"
            else
                echo -e "    ${RED}✗${NC} $col (缺失)"
            fi
        done

        # 检查索引
        echo "  检查索引："
        INDEXES=$(PGPASSWORD="${DATABASE_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT indexname FROM pg_indexes WHERE tablename = 'aggregated_volumes';" 2>/dev/null)

        if echo "$INDEXES" | grep -q "aggregated_volume_exchange_symbol_type_timestamp_key"; then
            echo -e "    ${GREEN}✓${NC} 唯一索引（exchange + symbol + type + timestamp）"
        else
            echo -e "    ${YELLOW}⚠${NC} 唯一索引缺失"
        fi

        # 检查数据
        ROW_COUNT=$(PGPASSWORD="${DATABASE_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM aggregated_volumes;" 2>/dev/null || echo "0")
        echo "  数据行数: $ROW_COUNT"

        if [ "$ROW_COUNT" -gt 0 ]; then
            echo -e "    ${GREEN}✓${NC} 表中有数据"
        else
            echo -e "    ${YELLOW}⚠${NC} 表中暂无数据（需要启动后端服务运行数据同步任务）"
        fi
    else
        echo -e "${RED}✗ aggregated_volumes 表不存在${NC}"
        echo -e "${YELLOW}提示：请执行迁移脚本：${NC}"
        echo "  psql -U $DB_USER -d $DB_NAME -f apps/backend/prisma/migrations/manual_add_aggregated_volume.sql"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ psql 未安装，跳过数据库表检查${NC}"
fi
echo ""

# 步骤 3: 检查数据同步任务配置
echo "步骤 3: 验证数据同步任务配置"
echo "----------------------------------------"

if command -v psql > /dev/null 2>&1; then
    TASK_COUNT=$(PGPASSWORD="${DATABASE_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM data_pull_tasks WHERE key LIKE 'markets-volume-sync-%';" 2>/dev/null || echo "0")

    if [ "$TASK_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✓ 找到 $TASK_COUNT 个数据同步任务${NC}"

        # 列出所有任务
        echo "  已配置的任务："
        PGPASSWORD="${DATABASE_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT key, enabled, interval_seconds FROM data_pull_tasks WHERE key LIKE 'markets-volume-sync-%' ORDER BY key;" 2>/dev/null | while IFS='|' read -r key enabled interval; do
            if [ "$enabled" = "t" ]; then
                echo -e "    ${GREEN}✓${NC} $key (启用, ${interval}秒)"
            else
                echo -e "    ${YELLOW}⚠${NC} $key (禁用)"
            fi
        done
    else
        echo -e "${RED}✗ 未找到数据同步任务${NC}"
        echo -e "${YELLOW}提示：请执行任务配置脚本：${NC}"
        echo "  psql -U $DB_USER -d $DB_NAME -f apps/backend/prisma/migrations/manual_add_volume_sync_tasks.sql"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ psql 未安装，跳过任务配置检查${NC}"
fi
echo ""

# 步骤 4: 检查 API 端点
echo "步骤 4: 验证 API 端点"
echo "----------------------------------------"

if command -v curl > /dev/null 2>&1; then
    # 检查后端服务是否运行
    if curl -s -o /dev/null -w "%{http_code}" "$API_BASE_URL/health" 2>/dev/null | grep -q "200"; then
        echo -e "${GREEN}✓ 后端服务正在运行${NC}"

        # 测试聚合交易量 API
        echo "  测试聚合交易量 API："
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE_URL/markets/volume/aggregated?symbol=BTC&instrumentType=PERPETUAL&page=1&limit=20" 2>/dev/null)

        if [ "$HTTP_CODE" = "200" ]; then
            echo -e "    ${GREEN}✓${NC} GET /markets/volume/aggregated (HTTP $HTTP_CODE)"

            # 获取响应内容
            RESPONSE=$(curl -s "$API_BASE_URL/markets/volume/aggregated?symbol=BTC&instrumentType=PERPETUAL&page=1&limit=5")
            TOTAL=$(echo "$RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2 || echo "0")

            if [ "$TOTAL" -gt 0 ]; then
                echo -e "    ${GREEN}✓${NC} API 返回 $TOTAL 条记录"
            else
                echo -e "    ${YELLOW}⚠${NC} API 返回 0 条记录（数据可能尚未同步）"
            fi
        else
            echo -e "    ${RED}✗${NC} GET /markets/volume/aggregated (HTTP $HTTP_CODE)"
        fi
    else
        echo -e "${RED}✗ 后端服务未运行${NC}"
        echo -e "${YELLOW}提示：请启动后端服务：${NC}"
        echo "  cd /Users/sa/Documents/codes/coinflux/stats_issue_agg_vol"
        echo "  node scripts/dx start backend --dev"
    fi
else
    echo -e "${YELLOW}⚠ curl 未安装，跳过 API 端点检查${NC}"
fi
echo ""

# 步骤 5: 检查前端文件
echo "步骤 5: 验证前端集成"
echo "----------------------------------------"

FRONTEND_FILE="apps/front/src/components/aggregated-orderbook/AggregatedVolume.tsx"
if [ -f "$FRONTEND_FILE" ]; then
    echo -e "${GREEN}✓ 前端组件文件存在${NC}"

    # 检查是否包含 API 调用
    if grep -q "client.GET.*markets/volume/aggregated" "$FRONTEND_FILE"; then
        echo -e "  ${GREEN}✓${NC} API 集成代码已添加"
    else
        echo -e "  ${RED}✗${NC} 未找到 API 集成代码"
    fi

    # 检查是否移除了 mock 数据
    if ! grep -q "const getItemsForSymbol = useCallback" "$FRONTEND_FILE"; then
        echo -e "  ${GREEN}✓${NC} Mock 数据已移除"
    else
        echo -e "  ${YELLOW}⚠${NC} 仍包含 Mock 数据生成器"
    fi
else
    echo -e "${RED}✗ 前端组件文件不存在${NC}"
fi
echo ""

# 总结
echo "========================================"
echo "验证完成"
echo "========================================"
echo ""
echo "下一步操作："
echo "1. 如果数据库表不存在，执行迁移脚本"
echo "2. 如果任务配置缺失，执行任务配置脚本"
echo "3. 启动后端服务：node scripts/dx start backend --dev"
echo "4. 启动前端服务：node scripts/dx start front --dev"
echo "5. 访问前端页面：http://localhost:3001/aggregated-orderbook"
echo ""
