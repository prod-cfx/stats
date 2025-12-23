#!/bin/bash

# AI Monorepo 开发环境启动脚本 - 仅启动 PostgreSQL 和 Redis

set -e

echo "🚀 启动 AI Monorepo 开发环境 (PostgreSQL + Redis)..."

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker 未运行，请先启动 Docker"
    exit 1
fi

# 进入 docker 目录
cd "$(dirname "$0")"

# 解析数据持久化目录（允许通过 DOCKER_DATA_DIR 自定义）
HOME_DIR="${HOME:-/Users/a1}"
DEFAULT_DATA_DIR="${HOME_DIR}/docker_data/ai-monorepo-dev"

# 如果未显式设置 DOCKER_DATA_DIR，尝试读取本地 .env 中的配置
if [ -z "${DOCKER_DATA_DIR:-}" ] && [ -f ./.env ]; then
    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
            ''|\#*)
                continue
                ;;
            *=*)
                key=${line%%=*}
                value=${line#*=}

                # 去除 key/value 两端的多余空白
                key=${key#"${key%%[![:space:]]*}"}
                key=${key%"${key##*[![:space:]]}"}
                key=${key#export }
                value=${value%$'\r'}
                value=${value#"${value%%[![:space:]]*}"}
                value=${value%"${value##*[![:space:]]}"}

                if [ "$key" = "DOCKER_DATA_DIR" ]; then
                    # 去除包裹的引号
                    value=${value%\"}
                    value=${value#\"}
                    value=${value%\'}
                    value=${value#\'}
                    DOCKER_DATA_DIR="$value"
                    break
                fi
                ;;
        esac
    done < ./.env
fi

BASE_DIR="${DOCKER_DATA_DIR:-$DEFAULT_DATA_DIR}"
BASE_DIR="${BASE_DIR//\$\{HOME\}/$HOME_DIR}"
BASE_DIR="${BASE_DIR//\$HOME/$HOME_DIR}"
BASE_DIR="${BASE_DIR/#\~/$HOME_DIR}"
export DOCKER_DATA_DIR="$BASE_DIR"

# 创建数据持久化目录（确保数据不会丢失）
echo "📁 准备数据持久化目录..."

mkdir -p "$BASE_DIR/postgres"
mkdir -p "$BASE_DIR/redis"
chmod -R 755 "$BASE_DIR" 2>/dev/null || true

echo "   ✅ 数据目录已就绪: $BASE_DIR"

# 启动服务
echo "📦 启动服务 (PostgreSQL + Redis)..."
docker-compose up -d

echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
echo "🔍 检查服务状态..."
if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo "✅ PostgreSQL 已就绪"
else
    echo "⚠️  PostgreSQL 可能还在启动中，请稍后使用 docker-compose logs postgres 查看日志"
fi

if docker-compose exec -T redis redis-cli -a redis ping > /dev/null 2>&1; then
    echo "✅ Redis 已就绪"
else
    echo "⚠️  Redis 可能还在启动中，请稍后使用 docker-compose logs redis 查看日志"
fi

echo ""
echo "🎉 开发环境启动成功！"
echo ""
echo "📊 服务信息："
echo "  PostgreSQL: localhost:5432"
echo "    用户: postgres | 密码: postgres | 数据库: ai_dev"
echo ""
echo "  Redis: localhost:6379"
echo "    密码: redis"
echo ""
echo "💾 数据持久化目录："
echo "  $BASE_DIR/postgres/"
echo "  $BASE_DIR/redis/"
echo ""
echo "📝 常用命令："
echo "  查看服务: docker-compose ps"
echo "  查看日志: docker-compose logs -f [postgres|redis]"
echo "  停止服务: docker-compose down"
echo "  连接 PostgreSQL: docker-compose exec postgres psql -U postgres -d ai_dev"
echo "  连接 Redis: docker-compose exec redis redis-cli -a redis"
