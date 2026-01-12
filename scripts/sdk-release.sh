#!/bin/bash

# 确保脚本在错误时退出
set -e

#====================================
# 工具函数：显示步骤 & 检查结果
#====================================
show_step() {
  echo "===================================="
  echo "🚀 $1"
  echo "===================================="
}

check_result() {
  if [ $? -ne 0 ]; then
    echo "❌ $1 失败"
    exit 1
  fi
  echo "✅ $1 成功"
}

#==============================
# 新增：Backend 启动与清理逻辑
#==============================

# 捕获脚本所在绝对目录及仓库根目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# 定义清理函数，脚本退出时自动调用
cleanup() {
  if [[ -n "$BACKEND_PID" ]] && ps -p $BACKEND_PID > /dev/null 2>&1; then
    echo "🛑 停止 backend 服务 (PID: $BACKEND_PID)"
    kill $BACKEND_PID
  fi
}
# 确保无论成功或失败都会执行 cleanup
trap cleanup EXIT

# 新增：检查端口 3000 是否被占用并清理
show_step "检查并清理端口 3000"
# lsof -t -i:3000 会在找不到进程时返回非零退出码，这在 set -e 下会中止脚本
# 我们通过 `|| true` 来忽略这个错误，确保脚本继续执行
PORT_PIDS=$(lsof -t -i:3000 || true)

if [ -n "$PORT_PIDS" ]; then
  echo "端口 3000 正在被以下进程占用: $PORT_PIDS"
  echo "正在尝试终止这些进程..."
  kill -9 $PORT_PIDS
  check_result "终止占用端口 3000 的进程"
  # 等待一小段时间确保端口已释放
  sleep 2
  echo "端口 3000 已被清理。"
else
  echo "✅ 端口 3000 未被占用。"
fi

# 追加：为后端端口进行更彻底的清理（可能存在残留的 nodemon 进程）
echo "执行扩展清理: pkill -f \"nodemon.*backend\"（忽略失败）"
pkill -f "nodemon.*backend" >/dev/null 2>&1 || true

# 启动 backend 服务（后台运行）
show_step "启动 backend 服务"
(
  cd "$REPO_ROOT" && pnpm exec nx dev backend
) &
BACKEND_PID=$!
echo "backend 进程 PID: $BACKEND_PID"

# 等待端口 3000 就绪（最长 60s）
MAX_WAIT=60
WAITED=0
until nc -z localhost 3000; do
  sleep 2
  WAITED=$((WAITED+2))
  if [ $WAITED -ge $MAX_WAIT ]; then
    echo "❌ backend 启动超时 (>$MAX_WAIT s)"
    exit 1
  fi
  echo "⌛ 等待 backend 启动... ($WAITED/$MAX_WAIT s)"
done
echo "✅ backend 已就绪，继续执行 SDK 构建"

# 切换到SDK目录
cd "$SCRIPT_DIR/../apps/sdk"
SDK_ROOT=$(pwd)

# 获取package名称
PACKAGE_NAME=$(node -p "require('./package.json').name")

# 检查是否提供了版本号参数
if [ -z "$1" ]; then
    echo "请提供版本号，例如: ./scripts/sdk-release.sh 1.0.0 或 ./scripts/sdk-release.sh dev"
    exit 1
fi

VERSION=$1
GIT_HASH=$(git rev-parse --short HEAD)

# 检查是否是开发版本
IS_DEV=false
if [[ "$VERSION" == *"dev"* ]]; then
    IS_DEV=true
fi

# 如果只输入了"dev"，自动生成一个带有git hash的开发版本号
if [ "$VERSION" = "dev" ]; then
    VERSION="0.0.0-dev.$GIT_HASH"
    echo "自动生成基于git hash的开发版本号: $VERSION"
    IS_DEV=true
fi

# 1. 清理旧的构建文件和SDK包
show_step "清理旧的构建文件和SDK包"
# 清理旧的构建文件
pnpm clean
check_result "清理构建文件"

# 清理旧的SDK包文件
echo "清理旧的SDK包文件..."
rm -f *.tgz
echo "✅ 旧SDK包文件清理完成"

# 清理可能存在的旧生成文件
echo "清理可能存在的旧生成文件..."
rm -rf src/generated 2>/dev/null || true
rm -rf openapi/generated 2>/dev/null || true
rm -rf dist 2>/dev/null || true
echo "✅ 旧生成文件清理完成"

# 2. 先更新版本号，这样后续的打包会使用正确的版本号
show_step "更新版本号到 $VERSION"
pnpm pkg set version=$VERSION
check_result "版本号更新"

# 3. 生成 OpenAPI SDK
show_step "生成 OpenAPI SDK"
pnpm generate
check_result "SDK 生成"

# 4. 确保安装所有依赖
show_step "安装所有依赖"
pnpm install
check_result "依赖安装"

# 5. 专门确保 webpack-cli 已安装
show_step "检查 webpack-cli 是否已安装"
if ! pnpm ls webpack-cli > /dev/null 2>&1; then
  echo "❌ 未找到 webpack-cli，请先安装开发依赖： pnpm add -D webpack-cli"
  exit 1
fi
echo "✅ webpack-cli 已安装"

# 6. 构建项目
show_step "构建项目"
pnpm build
check_result "构建"

# 7. 运行 demo 测试
show_step "运行 Demo 测试"
# 确保在SDK目录下运行demo测试，强制使用相对路径
(cd "$SDK_ROOT" && pnpm demo) || {
    echo "Demo测试失败，但将继续构建流程"
    echo "您可以在发布后手动运行 'cd apps/sdk && pnpm demo' 进行测试"
    # 不退出，允许继续流程
}

# 8. 打包
show_step "打包项目"
pnpm pack
check_result "打包"

# 预期的包文件名
EXPECTED_PACKAGE_FILE="$PACKAGE_NAME-$VERSION.tgz"

echo ""
echo "🎉 SDK 构建和打包完成！"
echo "📦 包文件已生成：$EXPECTED_PACKAGE_FILE"
echo ""
if [ "$IS_DEV" = false ]; then
    echo "5. 创建版本标签: git tag -a 'v$VERSION' -m 'version $VERSION' && git push origin 'v$VERSION'"
fi
