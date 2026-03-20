# Docker 开发环境

为 AI Monorepo 项目提供 PostgreSQL 和 Redis 开发环境。

## 服务说明

- **PostgreSQL 15**: 主数据库 (端口 5432)
- **Redis 7**: 缓存数据库 (端口 6379)

> **重要**：默认数据持久化到 `${HOME}/docker_data/ai-monorepo-dev/`，容器重启数据不会丢失，可通过 `DOCKER_DATA_DIR` 自定义。

## 快速开始

### 启动服务

```bash
cd docker
./start.sh
```

### 停止服务

```bash
docker-compose down
```

## 连接信息

### PostgreSQL

- **地址**: `localhost:5432`
- **用户**: `postgres`
- **密码**: `postgres`
- **数据库**: `ai_dev`

**连接字符串**:

```env
postgresql://postgres:postgres@localhost:5432/ai_dev
```

### Redis

- **地址**: `localhost:6379`
- **密码**: `redis`
- **数据库**: `0`

**连接字符串**:

```env
redis://:redis@localhost:6379/0
```

## 数据持久化

> **注意**：默认路径为 `${HOME}/docker_data/ai-monorepo-dev`，支持使用 `~` 表示当前用户目录。若需自定义，请在运行前设置 `DOCKER_DATA_DIR` 环境变量或复制 `docker/.env.example` 为 `docker/.env` 并调整同名配置，确保使用绝对路径。

所有数据存储在本地目录，容器删除后数据依然保留：

```tree
~/docker_data/ai-monorepo-dev/
├── postgres/    # PostgreSQL 数据文件
└── redis/       # Redis 数据文件
```

### 备份数据

```bash
cp -r "${DOCKER_DATA_DIR:-$HOME/docker_data/ai-monorepo-dev}" ~/backup/docker_data_$(date +%Y%m%d)
```

### 清理数据

```bash
# 停止服务
docker-compose down

# 删除数据（谨慎操作）
rm -rf "${DOCKER_DATA_DIR:-$HOME/docker_data/ai-monorepo-dev}"
```

## 常用命令

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f postgres
docker-compose logs -f redis

# 连接 PostgreSQL
docker-compose exec postgres psql -U postgres -d ai_dev

# 连接 Redis
docker-compose exec redis redis-cli -a redis

# 重启服务
docker-compose restart

# 停止服务
docker-compose down
```

## 服务隔离

本配置使用独立的命名空间 `ai-monorepo-dev`，不会与其他 Docker 服务冲突：

- 项目名称: `ai-monorepo-dev`
- 容器名称: `ai-monorepo-dev-postgres`, `ai-monorepo-dev-redis`
- 网络名称: `ai-monorepo-dev-network`

## 配置文件对应

与项目 `.env.development.local` 配置对应：

```env
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_dev

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis
REDIS_DB=0
REDIS_URL=redis://:redis@localhost:6379/0
```

## 故障排除

### 端口被占用

```bash
# 检查端口占用
lsof -i :5432
lsof -i :6379

# 停止冲突的服务
docker-compose down
```

### 服务启动失败

```bash
# 查看详细日志
docker-compose logs postgres
docker-compose logs redis

# 重新创建容器
docker-compose down
docker-compose up -d
```

### 数据库连接失败

```bash
# 检查服务状态
docker-compose ps

# 测试连接
docker-compose exec postgres pg_isready -U postgres
docker-compose exec redis redis-cli -a redis ping
```

### 完全重置

```bash
# 停止并删除容器
docker-compose down -v

# 清理数据（可选）
rm -rf "${DOCKER_DATA_DIR:-$HOME/docker_data/ai-monorepo-dev}"

# 重新启动
./start.sh
```
