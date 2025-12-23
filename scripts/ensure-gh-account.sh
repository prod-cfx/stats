#!/bin/bash
# 确保使用正确的 GitHub 账号
# 用法：./scripts/ensure-gh-account.sh [账号名称]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env.development.local"

EXPECTED_ACCOUNT=""

# 1. 优先使用命令行参数
if [ -n "$1" ]; then
  EXPECTED_ACCOUNT="$1"
  echo "📝 使用命令行参数指定的账号: $EXPECTED_ACCOUNT"
# 2. 其次从 .env.development.local 读取 GH_ACCOUNT
elif [ -f "$ENV_FILE" ]; then
  # 使用 grep 和 sed 提取 GH_ACCOUNT 的值
  EXPECTED_ACCOUNT=$(grep "^GH_ACCOUNT=" "$ENV_FILE" 2>/dev/null | head -1 | sed 's/^GH_ACCOUNT=//' | tr -d '"' | tr -d "'" | tr -d '[:space:]')
  
  if [ -z "$EXPECTED_ACCOUNT" ]; then
    echo "⚠️  未在 $ENV_FILE 中找到 GH_ACCOUNT 配置"
  else
    echo "📝 从 .env.development.local 读取账号: $EXPECTED_ACCOUNT"
  fi
fi

# 3. 如果都没有，提示用户手动配置
if [ -z "$EXPECTED_ACCOUNT" ]; then
  echo ""
  echo "⚠️  未找到 GitHub 账号配置"
  echo ""
  echo "请选择以下方式之一："
  echo ""
  echo "1. 在 .env.development.local 中添加配置（推荐）："
  echo "   echo 'GH_ACCOUNT=your-github-username' >> .env.development.local"
  echo ""
  echo "2. 使用命令行参数："
  echo "   ./scripts/ensure-gh-account.sh your-github-username"
  echo ""
  echo "3. 手动切换账号："
  echo "   gh auth switch"
  echo ""
  exit 1
fi

# 获取当前活跃账号（使用 gh api 最可靠）
CURRENT_ACCOUNT=$(gh api user 2>/dev/null | jq -r '.login' || echo "unknown")

if [ "$CURRENT_ACCOUNT" = "unknown" ]; then
  echo "❌ 无法获取当前 gh 账号，请确保已登录"
  echo "提示：运行 'gh auth login' 登录"
  exit 1
fi

if [ "$CURRENT_ACCOUNT" != "$EXPECTED_ACCOUNT" ]; then
  echo "⚠️  当前 gh CLI 账号: $CURRENT_ACCOUNT"
  echo "📝 项目要求账号: $EXPECTED_ACCOUNT"
  echo "🔄 正在切换账号..."
  
  # 使用 --user 参数指定账号（gh auth switch 不从 stdin 读取）
  gh auth switch --hostname github.com --user "$EXPECTED_ACCOUNT" 2>&1
  
  if [ $? -eq 0 ]; then
    # 再次验证是否切换成功
    NEW_ACCOUNT=$(gh api user 2>/dev/null | jq -r '.login' || echo "unknown")
    if [ "$NEW_ACCOUNT" = "$EXPECTED_ACCOUNT" ]; then
      echo "✅ 已成功切换到 $EXPECTED_ACCOUNT"
    else
      echo "⚠️  切换命令执行但验证失败，当前账号: $NEW_ACCOUNT"
    fi
  else
    echo "❌ 切换失败，请手动执行: gh auth switch"
    exit 1
  fi
else
  echo "✅ 当前使用正确的账号: $EXPECTED_ACCOUNT"
fi
