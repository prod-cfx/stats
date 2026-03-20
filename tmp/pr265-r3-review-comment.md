<!-- pr-review-loop-marker -->
### Summary
- P0: 0 / P1: 2 / P2: 4 / P3: 2

### Pending P0/P1/P2 issues
1. **CDX-001** (P1, quality) - jest 版本与 jsdom 环境不匹配
   - file: apps/admin-front/package.json
   - line: 39
   - suggestion: 将 jest-environment-jsdom 固定为 ^29.7.0 或同步升级 jest/ts-jest 到 30.x，保持环境包与核心版本一致。

2. **CDX-002** (P2, performance) - 批量操作缺少并发控制
   - file: apps/admin-front/src/app/(protected)/data-pull-tasks/page.tsx
   - line: 414
   - suggestion: 限制 bulk action 并发（例如 p-limit 或分批 chunk）并在 UI 中展示“已完成 X/Y”反馈，避免短时间打爆后端。

3. **CLD-001** (P2, quality) - console.warn 在生产环境仍会输出调试信息
   - file: apps/admin-front/src/lib/bulk-action.ts
   - line: 70
   - suggestion: 仅在开发环境保留 console.warn，生产环境改用 console.error 或集中上报，并在代码中添加触发条件说明。

4. **CLD-002** (P2, performance) - 批量操作缺少并发控制和进度反馈
   - file: apps/admin-front/src/app/(protected)/data-pull-tasks/page.tsx
   - line: 414
   - suggestion: 为大批量操作（如超过 20）提供二次确认，限制同时执行数量（5-10），并展示实时进度条或 X/Y 状态。

5. **GMN-003** (P1, performance) - Unbounded concurrency in bulk actions
   - file: apps/admin-front/src/app/(protected)/data-pull-tasks/page.tsx
   - line: 416
   - suggestion: 引入并发限制（p-limit 或 chunked loop），按固定并发数运行 Promise.allSettled，并收集分块结果。

6. **GMN-004** (P2, architecture) - Repetitive bulk action handlers
   - file: apps/admin-front/src/app/(protected)/data-pull-tasks/page.tsx
   - line: 429
   - suggestion: 抽取通用 handler（如 performBulkOperation）封装 Modal.confirm、state update、runBulkAction、loadTasks 等逻辑。

### Original reviewer comments
<details>
<summary>CDX review</summary>

```text
# Review (CDX)

PR: 265
Round: 3

## Summary

P0: 0
P1: 1
P2: 1
P3: 0

## Findings

- id: CDX-001
  priority: P1
  category: quality
  file: apps/admin-front/package.json
  line: 39
  title: jest 版本与 jsdom 环境不匹配
  description: 当前使用 jest@29.x，但 devDependencies 里引入 jest-environment-jsdom@30.x。Jest 29 与 30 的环境包存在 API/peer 版本差异，测试运行时可能直接报错或加载失败。
  suggestion: 将 jest-environment-jsdom 固定到 ^29.7.0（与 jest 版本对齐），或同步升级 jest/ts-jest 到 30.x 并更新配置。

- id: CDX-002
  priority: P2
  category: performance
  file: apps/admin-front/src/app/(protected)/data-pull-tasks/page.tsx
  line: 414
  title: 批量操作缺少并发控制
  description: runBulkAction 直接对选中任务 Promise.allSettled 并发执行。大量任务时会同时打爆后端接口，导致超时或被限流，前端也无法提供进度反馈。
  suggestion: 使用并发限制（如 p-limit/分批循环）并在 UI 中输出“已完成 X/Y”进度，避免瞬时请求洪峰。
```
</details>

<details>
<summary>CLD review</summary>

```text
# Review (CLD)

PR: 265
Round: 3

## Summary

P0: 0
P1: 0
P2: 2
P3: 1

## Findings

- id: CLD-001
  priority: P2
  category: quality
  file: apps/admin-front/src/lib/bulk-action.ts
  line: 70
  title: console.warn 在生产环境仍会输出调试信息
  description: |
    aggregateBulkSettledResults 函数在 targets 和 results 长度不匹配时使用 console.warn 输出警告。
    这种情况在批量操作时可能偶发（如网络超时导致部分 Promise 未 settle），但 console.warn 会在生产环境
    污染日志，且无法被集中监控系统捕获。
  suggestion: |
    - 开发环境保留 console.warn
    - 生产环境改用 console.error 或集中错误上报（如 Sentry）
    - 增加注释说明该警告的触发条件和影响范围

- id: CLD-002
  priority: P2
  category: performance
  file: apps/admin-front/src/app/(protected)/data-pull-tasks/page.tsx
  line: 414
  title: 批量操作缺少并发控制和进度反馈
  description: |
    runBulkAction 使用 Promise.allSettled 无限制并发执行所有操作，存在以下问题：
    1. 大批量操作（如 100+ 任务）会同时发起 100+ HTTP 请求，可能触发浏览器并发限制或后端限流
    2. 用户无法得知当前执行进度（已完成 X/Y），体验较差
    3. 缺少二次确认或防抖机制，误操作风险高
  suggestion: |
    1. 引入并发控制（如 p-limit，限制同时执行 5-10 个）
    2. 对 > 20 个任务的批量操作增加二次确认弹窗，显示具体任务列表
    3. 大批量操作时展示进度条或 "已完成 X/Y" 实时反馈
    4. 考虑将 runBulkAction 抽取为自定义 Hook（useBulkAction）以便复用

- id: CLD-003
  priority: P3
  category: architecture
  file: apps/admin-front/src/app/(protected)/data-pull-tasks/page.tsx
  line: 428
  title: 批量操作逻辑可抽取为自定义 Hook 提升复用性
  description: |
    handleBulkTrigger、handleBulkInterrupt、handleBulkEnable、handleBulkDisable 四个函数结构高度相似，
    都包含 modal.confirm、setBulkAction、runBulkAction、loadTasks、setSelectedRowKeys 等重复逻辑。
    当前实现虽然可读性尚可，但新增批量操作（如批量删除）时需要重复编写相同代码。
  suggestion: |
    抽取为自定义 Hook：useBulkAction，接受以下参数：
    - title: string（确认弹窗标题）
    - targets: BulkTarget[]（目标任务列表）
    - action: (id: number) => Promise<unknown>（单个操作函数）
    - onSuccess?: () => void（成功后回调，用于刷新列表）
    - confirmOptions?: { content?: string; okButtonProps?: ButtonProps }（自定义确认弹窗配置）
    返回 { trigger: () => void, loading: boolean }，简化调用代码。
```
</details>

<details>
<summary>GMN review</summary>

```text
# Review (GMN)

PR: 265
Round: 3

## Summary

P0: 0
P1: 1
P2: 1
P3: 1

## Findings

- id: GMN-003
  priority: P1
  category: performance
  file: apps/admin-front/src/app/(protected)/data-pull-tasks/page.tsx
  line: 416
  title: Unbounded concurrency in bulk actions
  description: |
    `runBulkAction` uses `Promise.allSettled` on the entire `targets` array immediately.
    If a user selects 50+ tasks, this will trigger 50+ concurrent HTTP requests, potentially overwhelming the browser's connection limit or the backend.
  suggestion: |
    Implement concurrency limiting. Since you are in a Next.js/React environment, you can use a utility like `p-limit` (if available) or implement a simple chunked execution loop.
    
    Example:
    ```typescript
    const concurrency = 5;
    const results = [];
    for (let i = 0; i < targets.length; i += concurrency) {
      const chunk = targets.slice(i, i + concurrency);
      const chunkResults = await Promise.allSettled(chunk.map(t => action(t.id)));
      results.push(...chunkResults);
    }
    ```

- id: GMN-004
  priority: P2
  category: architecture
  file: apps/admin-front/src/app/(protected)/data-pull-tasks/page.tsx
  line: 429
  title: Repetitive bulk action handlers
  description: |
    `handleBulkTrigger`, `handleBulkInterrupt`, `handleBulkEnable`, and `handleBulkDisable` share nearly identical boilerplate code (Modal.confirm -> setState -> map targets -> runBulkAction -> reload -> reset).
    This code duplication makes the component harder to maintain.
  suggestion: |
    Extract a generic handler.
    
    ```typescript
    const performBulkOperation = async (
      actionKey: BulkActionType, 
      confirmTitle: string, 
      confirmContent: string, 
      confirmBtnText: string,
      confirmDanger: boolean,
      apiCall: (id: number) => Promise<void>,
      targetList: DataPullTask[]
    ) => {
      // ... modal confirm logic wrapping the execution ...
    }
    ```

- id: GMN-005
  priority: P3
  category: quality
  file: apps/admin-front/src/lib/bulk-action.ts
  line: 70
  title: Direct console.warn usage
  description: Direct use of `console.warn` in library code.
  suggestion: Ideally, use a consistent logger or throw a proper error if this state is invalid. If it's just a dev warning, wrap it in `if (process.env.NODE_ENV === 'development')`.
```
</details>
