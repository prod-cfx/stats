#!/bin/bash

# OAuth 凭证快速诊断脚本
# 用法: ./scripts/oauth-debug.sh

echo "🔍 OAuth 凭证诊断工具"
echo "======================"

# 检查后端是否运行
if ! curl -s http://localhost:3000/api/v1/health > /dev/null 2>&1; then
    echo "❌ 后端服务未运行，请先启动后端："
    echo "   ./scripts/dx start backend --dev"
    exit 1
fi

echo "✅ 后端服务正在运行"
echo ""

# OAuth 健康检查
echo "📋 OAuth 配置检查："
echo "==================="
curl -s "http://localhost:3000/api/v1/auth/debug/oauth-health" | jq '.google, .recommendations'
echo ""

# OAuth 凭证测试
echo "🧪 OAuth 凭证测试："
echo "==================="
curl -s "http://localhost:3000/api/v1/auth/debug/test-credentials" | jq '.'
echo ""

# 检查环境变量文件
echo "📁 环境变量文件检查："
echo "==================="
LOCAL_ENV_FILE=".env.development.local"
if [ -f "$LOCAL_ENV_FILE" ]; then
    echo "✅ $LOCAL_ENV_FILE 存在"
    if grep -q "GOOGLE_CLIENT_ID" "$LOCAL_ENV_FILE"; then
        echo "✅ GOOGLE_CLIENT_ID 已配置"
    else
        echo "❌ GOOGLE_CLIENT_ID 未配置"
    fi
    if grep -q "GOOGLE_CLIENT_SECRET" "$LOCAL_ENV_FILE"; then
        echo "✅ GOOGLE_CLIENT_SECRET 已配置"
    else
        echo "❌ GOOGLE_CLIENT_SECRET 未配置"
    fi
    if grep -q "GOOGLE_CALLBACK_URL" "$LOCAL_ENV_FILE"; then
        echo "✅ GOOGLE_CALLBACK_URL 已配置"
    else
        echo "❌ GOOGLE_CALLBACK_URL 未配置"
    fi
else
    echo "❌ $LOCAL_ENV_FILE 文件不存在"
fi
echo ""

echo "💡 故障排除建议："
echo "================="
echo "如果遇到 'invalid_client' 错误："
echo "1. 检查 Google Cloud Console 中的 OAuth 客户端状态"
echo "2. 确认重定向 URI 完全匹配: http://localhost:3000/api/v1/auth/google/callback"
echo "3. 如果问题持续，创建新的 OAuth 2.0 客户端"
echo "4. 查看后端日志中的详细错误信息"
echo ""
echo "🔗 有用的链接："
echo "- Google Cloud Console: https://console.cloud.google.com/apis/credentials"
echo "- OAuth 健康检查: http://localhost:3000/api/v1/auth/debug/oauth-health"
echo "- 凭证测试: http://localhost:3000/api/v1/auth/debug/test-credentials"
