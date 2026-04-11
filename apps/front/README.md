# 前端应用（front）

当前前端以 Next.js App Router 实现，面向 `backend` 的 `/api/v1/*` 接口。
应用内主要通过 [src/lib/api.ts](src/lib/api.ts) 暴露业务 API 方法，并由 [src/lib/api-client.ts](src/lib/api-client.ts) 统一处理基础地址、Zodios client、SSR fallback 与响应解包。

- 当前仓库没有单独的 `docs/frontend-data-fetching.md`；前端数据获取约定请直接参考：
  - [src/lib/api.ts](src/lib/api.ts)
  - [src/lib/api-client.ts](src/lib/api-client.ts)
  - [project.json](project.json)
- 构建与开发命令均需从仓库根目录使用全局 `dx` 执行。
