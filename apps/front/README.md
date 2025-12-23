# 前端应用（front）

当前前端以 Next.js App Router 实现，直接通过 `apps/front/src/lib/api.ts` 与后端 `/api/v1/*` 接口交互。所有请求都走这一封装，便于统一附加 Token、处理错误以及在开发/部署环境间切换。

- 数据获取最佳实践请参考：`/docs/frontend-data-fetching.md`
- 构建与开发命令均需从仓库根目录使用 `./scripts/dx` 执行。
