#!/bin/bash

# 远程推送地址管理脚本
# 用于管理 git@github.com:my-release/ai-monorepo.git 推送地址

RELEASE_REMOTE="git@github.com:my-release/ai-monorepo.git"
ORIGINAL_REMOTE="git@github.com:shitgood-bradford54/ai-monorepo.git"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 显示帮助信息
show_help() {
    echo -e "${BLUE}远程推送地址管理脚本${NC}"
    echo ""
    echo "用法: $0 [命令] [选项]"
    echo ""
    echo "命令:"
    echo "  add                    添加 release 推送地址"
    echo "  remove                 移除 release 推送地址"
    echo "  status                 显示当前远程配置"
    echo "  push [branch]          推送指定分支到 release 仓库"
    echo "  push-all [branch]      推送指定分支到所有配置的仓库"
    echo "  help                   显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 add                 # 添加 release 推送地址"
    echo "  $0 remove              # 移除 release 推送地址"
    echo "  $0 push main           # 只推送 main 分支到 release 仓库"
    echo "  $0 push-all main       # 推送 main 分支到所有仓库"
    echo "  $0 status              # 查看当前配置"
}

# 显示当前远程配置
show_status() {
    echo -e "${BLUE}当前远程仓库配置:${NC}"
    git remote -v
    echo ""

    # 检查是否已添加 release 推送地址
    if git remote -v | grep -q "my-release/ai-monorepo.git.*push"; then
        echo -e "${GREEN}✓ Release 推送地址已配置${NC}"
    else
        echo -e "${YELLOW}⚠ Release 推送地址未配置${NC}"
    fi
}

# 添加 release 推送地址
add_release_remote() {
    echo -e "${BLUE}添加 release 推送地址...${NC}"

    # 检查是否已存在
    if git remote -v | grep -q "my-release/ai-monorepo.git.*push"; then
        echo -e "${YELLOW}Release 推送地址已存在${NC}"
        return 0
    fi

    # 先添加 release 推送地址
    git remote set-url --add --push origin "$RELEASE_REMOTE"

    # 再添加原始推送地址（确保顺序正确）
    git remote set-url --add --push origin "$ORIGINAL_REMOTE"

    echo -e "${GREEN}✓ Release 推送地址添加成功${NC}"
    show_status
}

# 移除 release 推送地址
remove_release_remote() {
    echo -e "${BLUE}移除 release 推送地址...${NC}"

    # 检查是否存在
    if ! git remote -v | grep -q "my-release/ai-monorepo.git.*push"; then
        echo -e "${YELLOW}Release 推送地址不存在${NC}"
        return 0
    fi

    # 完全重置远程配置，避免重复地址
    git remote remove origin
    git remote add origin "$ORIGINAL_REMOTE"

    echo -e "${GREEN}✓ Release 推送地址移除成功${NC}"
    show_status
}

# 推送到 release 仓库
push_to_release() {
    local branch=${1:-$(git branch --show-current)}

    if [ -z "$branch" ]; then
        echo -e "${RED}错误: 无法确定当前分支${NC}"
        exit 1
    fi

    echo -e "${BLUE}推送分支 '$branch' 到 release 仓库...${NC}"

    # 直接推送到 release 仓库
    if git push "$RELEASE_REMOTE" "$branch"; then
        echo -e "${GREEN}✓ 成功推送到 release 仓库${NC}"
    else
        echo -e "${RED}✗ 推送到 release 仓库失败${NC}"
        exit 1
    fi
}

# 推送到所有仓库
push_to_all() {
    local branch=${1:-$(git branch --show-current)}

    if [ -z "$branch" ]; then
        echo -e "${RED}错误: 无法确定当前分支${NC}"
        exit 1
    fi

    echo -e "${BLUE}推送分支 '$branch' 到所有配置的仓库...${NC}"

    # 使用 git push origin，会推送到所有配置的推送地址
    if git push origin "$branch"; then
        echo -e "${GREEN}✓ 成功推送到所有仓库${NC}"
    else
        echo -e "${RED}✗ 推送失败${NC}"
        exit 1
    fi
}

# 主逻辑
case "${1:-help}" in
    "add")
        add_release_remote
        ;;
    "remove")
        remove_release_remote
        ;;
    "status")
        show_status
        ;;
    "push")
        push_to_release "$2"
        ;;
    "push-all")
        push_to_all "$2"
        ;;
    "help"|"--help"|"-h")
        show_help
        ;;
    *)
        echo -e "${RED}错误: 未知命令 '$1'${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
