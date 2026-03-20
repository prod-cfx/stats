<!-- pr-review-loop-marker -->
Summary: P0: 0 / P1: 2 / P2: 5 / P3: 2

P1/P2 Issues to resolve:
1. **CLD-001** (P1, quality) - `apps/admin-front/src/app/(protected)/data-pull-tasks/page.tsx`:203
   - Title: useEffect 初始化缺少依赖导致潜在陈旧闭包问题
   - Suggestion: 将 loadTasks/loadRegisteredJobs 纳入依赖或用稳定引用（如 useRef），并留下注释说明仅在挂载时执行。
2. **CLD-002** (P1, performance) - `apps/admin-front/src/app/(protected)/data-pull-tasks/page.tsx`:429
   - Title: 批量操作缺少防抖/节流机制，可能导致重复提交
   - Suggestion: 在 runBulkAction 中限制并发（例如 p-limit 10），大批量时增加二次确认，并展示 "已完成 X/Y" 反馈。
3. **CLD-003** (P2, quality) - `apps/admin-front/src/app/(protected)/data-pull-tasks/page.tsx`:408
   - Title: 行选择键值转换逻辑可简化
   - Suggestion: 直接过滤 number 类型或断言，并在发现非常规 key 时输出日志。
4. **CLD-004** (P2, quality) - `apps/admin-front/src/lib/bulk-action.ts`:70
   - Title: console.warn 应该使用统一的日志系统
   - Suggestion: 仅在 development 保留 console.warn，生产环境切换为集中上报/console.error，并增加调用者注释。
5. **CLD-005** (P2, architecture) - `apps/admin-front/src/app/(protected)/data-pull-tasks/page.tsx`:429
   - Title: 批量操作逻辑应该抽取为自定义 Hook
   - Suggestion: 抽成 `useBulkAction`（含 modal.confirm、状态管理、runBulkAction、onSuccess 回调）以复用共通流程。
6. **GMN-001** (P2, quality) - `apps/admin-front/src/app/(protected)/data-pull-tasks/page.tsx`:293
   - Title: Duplicate error handling logic
   - Suggestion: 用 `toErrorMessage(error)` 替换冗长的错误提取，统一 message.error 输出。
7. **GMN-002** (P2, architecture) - `apps/admin-front/package.json`:31
   - Title: Missing jest-environment-jsdom dependency
   - Suggestion: 在 admin-front 的 devDependencies 显式添加 `jest-environment-jsdom`。

<details>
<summary>CDX review</summary>

```text
# Review (CDX)

PR: 265
Round: 2

## Summary

P0: 0
P1: 0
P2: 0
P3: 0

## Findings

```
</details>

<details>
<summary>CLD review</summary>

```text
# Review (CLD)

PR: 265
Round: 2

## Summary

P0: 0
P1: 2
P2: 3
P3: 2

## Findings

- id: CLD-001
  priority: P1
  category: quality
  file: apps/admin-front/src/app/(protected)/data-pull-tasks/page.tsx
  line: 203
  title: useEffect 初始化缺少依赖导致潜在陈旧闭包问题
  description: |
    第 197-201 行的 useEffect 在组件初始化时调用 loadTasks 和 loadRegisteredJobs，
    但依赖数组被 eslint-disable 绕过。虽然这对于"只在挂载时执行一次"的场景是常见做法，
    但存在两个隐患：
    1. loadTasks 和 loadRegisteredJobs 的实现依赖 message（来自 App.useApp()），
       如果未来这些回调引用了其他状态，会导致陈旧闭包。
    2. eslint-disable 隐藏了依赖问题，使得未来维护者难以发现问题根源。
    
    当前场景下，loadTasks 和 loadRegisteredJobs 使用 useCallback 且依赖稳定（message 来自 Context），
    因此暂时安全，但违反了"显式依赖"原则。
  suggestion: |
    建议：
    1. 将 loadTasks 和 loadRegisteredJobs 添加到依赖数组，并确保它们由 useCallback 包装且依赖稳定。
    2. 或者，使用 useRef 保存稳定引用，避免 eslint-disable。
    3. 添加注释说明为何安全，例如：
       ```typescript
       // loadTasks 和 loadRegisteredJobs 由 useCallback 包装且依赖稳定（message 来自 Context）
       // 仅在挂载时执行一次
       ```

- id: CLD-002
  priority: P1
  category: performance
  file: apps/admin-front/src/app/(protected)/data-pull-tasks/page.tsx
  line: 429
  title: 批量操作缺少防抖/节流机制，可能导致重复提交
  description: |
    批量操作按钮（handleBulkTrigger/handleBulkInterrupt/handleBulkEnable/handleBulkDisable）
    虽然在操作过程中通过 bulkAction 状态禁用了按钮，但用户仍可能在短时间内重复点击。
    
    虽然当前通过 `disabled={bulkAction !== null}` 实现了基本保护，但在高延迟网络环境下，
    用户可能在第一次点击到 Modal confirm 显示之间多次点击按钮。
    
    此外，批量操作本身是并发执行（Promise.allSettled），但没有限制并发数。
    如果选中 1000+ 个任务同时触发，可能导致：
    - 浏览器内存/CPU 压力
    - 后端接口被瞬间打满（虽然后端应该有限流，但前端应该先做好防护）
  suggestion: |
    建议：
    1. 在 runBulkAction 中添加并发控制，例如使用 p-limit 限制并发数为 10：
       ```typescript
       import pLimit from 'p-limit'
       const limit = pLimit(10)
       const results = await Promise.allSettled(
         targets.map(target => limit(() => action(target.id)))
       )
       ```
    2. 或者在大批量场景下（如 selectedRowKeys.length > 100），弹出二次确认。
    3. 添加操作进度提示（如"已完成 X/Y"）。

- id: CLD-003
  priority: P2
  category: quality
  file: apps/admin-front/src/app/(protected)/data-pull-tasks/page.tsx
  line: 408
  title: 行选择键值转换逻辑可简化
  description: |
    handleRowSelectionChange 中的键值转换逻辑（396-405 行）使用循环 + Number() + Number.isFinite() 
    来过滤非数字键，但实现较为冗长。
    
    虽然逻辑正确且经过测试（见 commit 7d1291e），但在 Ant Design Table 的 rowKey="id" 
    场景下，实际上返回的 keys 已经是 number 类型（除非有 bug）。
    
    当前实现过于防御性，增加了代码复杂度。
  suggestion: |
    建议简化为：
    ```typescript
    const handleRowSelectionChange = useCallback((keys: Key[]) => {
      setSelectedRowKeys(keys.filter(k => typeof k === 'number') as number[])
    }, [])
    ```
    
    或者更简洁（假设 Ant Design 保证类型正确）：
    ```typescript
    const handleRowSelectionChange = useCallback((keys: Key[]) => {
      setSelectedRowKeys(keys as number[])
    }, [])
    ```
    
    如果担心类型安全，可以添加 runtime 断言：
    ```typescript
    const handleRowSelectionChange = useCallback((keys: Key[]) => {
      if (keys.some(k => typeof k !== 'number')) {
        console.error('Unexpected non-number key in row selection', keys)
      }
      setSelectedRowKeys(keys as number[])
    }, [])
    ```

- id: CLD-004
  priority: P2
  category: quality
  file: apps/admin-front/src/lib/bulk-action.ts
  line: 70
  title: console.warn 应该使用统一的日志系统
  description: |
    aggregateBulkSettledResults 在 results 长度不匹配时使用 console.warn 输出警告。
    
    虽然对开发调试有帮助，但生产环境中：
    1. console.warn 会暴露在浏览器控制台，可能泄露内部状态信息
    2. 没有统一的日志收集机制，无法在生产环境中追踪问题
    
    当前场景下，长度不匹配通常是编程错误（如 Promise.allSettled 的 map 逻辑错误），
    但函数已经做了容错处理（normalizedResults.slice(0, targets.length)），所以不会崩溃。
  suggestion: |
    建议：
    1. 在开发环境保留 console.warn，生产环境改为 Sentry/监控系统上报：
       ```typescript
       if (results.length !== targets.length) {
         if (process.env.NODE_ENV === 'development') {
           console.warn(...)
         } else {
           // Sentry.captureMessage(...)
         }
       }
       ```
    2. 或者将 console.warn 改为 console.error（表示更严重的问题），并在单测中验证。
    3. 考虑在函数签名中增加注释，说明调用者的责任（确保 results.length === targets.length）。

- id: CLD-005
  priority: P2
  category: architecture
  file: apps/admin-front/src/app/(protected)/data-pull-tasks/page.tsx
  line: 429
  title: 批量操作逻辑应该抽取为自定义 Hook
  description: |
    批量操作相关的 4 个 handler（handleBulkTrigger/handleBulkInterrupt/handleBulkEnable/handleBulkDisable）
    有大量重复逻辑：
    - modal.confirm 确认弹窗
    - setBulkAction 状态管理
    - runBulkAction 执行
    - loadTasks 刷新列表
    - setSelectedRowKeys([]) 清空选择
    - try-catch 错误处理
    
    当前实现导致：
    1. 代码重复度高（4 个 handler 共 ~200 行）
    2. 未来新增批量操作（如批量删除）需要复制粘贴
    3. 修改共同逻辑（如增加进度提示）需要改 4 处
  suggestion: |
    建议抽取为自定义 Hook `useBulkAction`：
    ```typescript
    function useBulkAction({
      tasks,
      selectedRowKeys,
      onSuccess,
    }: {
      tasks: DataPullTask[]
      selectedRowKeys: number[]
      onSuccess: () => Promise<void>
    }) {
      const { message, modal } = App.useApp()
      const [bulkAction, setBulkAction] = useState<string | null>(null)
      
      const execute = useCallback(async (
        action: string,
        title: string,
        filter: (task: DataPullTask) => boolean,
        handler: (id: number) => Promise<unknown>,
        confirmOptions?: { danger?: boolean }
      ) => {
        const targetTasks = tasks.filter(t => selectedRowKeys.includes(t.id) && filter(t))
        if (!targetTasks.length) return
        
        modal.confirm({
          title: `确认${title}?`,
          content: `将${title}选中的 ${targetTasks.length} 个任务。`,
          okText: title,
          okButtonProps: confirmOptions?.danger ? { danger: true } : undefined,
          cancelText: '取消',
          async onOk() {
            setBulkAction(action)
            try {
              await runBulkAction(title, targetTasks, handler)
              await onSuccess()
            } finally {
              setBulkAction(null)
            }
          },
        })
      }, [tasks, selectedRowKeys, modal, message, onSuccess])
      
      return { bulkAction, execute }
    }
    ```
    
    使用示例：
    ```typescript
    const { bulkAction, execute } = useBulkAction({
      tasks,
      selectedRowKeys,
      onSuccess: async () => {
        await loadTasks(...)
        setSelectedRowKeys([])
      }
    })
    
    const handleBulkTrigger = () => execute(
      'trigger',
      '批量立即执行',
      () => true,
      triggerDataPullTask
    )
    ```

- id: CLD-006
  priority: P3
  category: quality
  file: apps/admin-front/jest.config.ts
  line: null
  title: Jest 配置缺少覆盖率收集配置
  description: |
    当前 jest.config.ts 只包含基础配置（preset、testEnvironment、transform、moduleNameMapper），
    缺少覆盖率收集相关配置。
    
    虽然可以通过 `jest --coverage` 临时开启，但没有配置：
    - collectCoverageFrom：指定收集覆盖率的文件范围
    - coverageThreshold：设置覆盖率阈值（如 80%）
    - coveragePathIgnorePatterns：排除不需要覆盖的文件（如 *.test.ts、*.config.ts）
    
    当前 PR 新增的 bulk-action.ts 有完整的单元测试，覆盖率应该很高，
    但没有配置强制要求未来的代码也保持相同标准。
  suggestion: |
    建议补充覆盖率配置：
    ```typescript
    const config: Config = {
      // ... 现有配置
      collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.test.{ts,tsx}',
        '!src/**/*.spec.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/index.{ts,tsx}',
      ],
      coverageThreshold: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    }
    ```

- id: CLD-007
  priority: P3
  category: quality
  file: apps/admin-front/src/lib/bulk-action.test.ts
  line: 46
  title: 单元测试缺少边界场景覆盖
  description: |
    当前测试覆盖了主要场景（全成功、部分失败、空输入、批量更新），但缺少以下边界场景：
    
    1. **结果长度大于目标长度**：
       - targets.length = 2, results.length = 3
       - 预期：只处理前 2 个结果，忽略第 3 个
    
    2. **错误对象的嵌套结构变体**：
       - error.data.message（当前已覆盖）
       - error.response.data.error（当前已覆盖）
       - 但缺少：error.response.data.message + error.response.data.error 同时存在（应该优先 message）
    
    3. **toErrorMessage 的边界输入**：
       - null/undefined（虽然类型系统禁止，但 runtime 可能传入）
       - 空字符串 ''
       - 只有空格的字符串 '   '
       - Error 对象但 message 为空字符串
    
    当前实现已经处理了这些情况（trim() + fallback），但测试未覆盖。
  suggestion: |
    建议补充测试用例：
    ```typescript
    it('ignores extra results when results.length > targets.length', () => {
      const results = [
        { status: 'fulfilled', value: {} },
        { status: 'fulfilled', value: {} },
        { status: 'rejected', reason: new Error('should be ignored') },
      ]
      const aggregate = aggregateBulkSettledResults(targets.slice(0, 2), results)
      expect(aggregate.total).toBe(2)
      expect(aggregate.successCount).toBe(2)
    })

    it('prioritizes response.data.message over response.data.error', () => {
      const error = {
        response: {
          data: {
            message: 'message value',
            error: 'error value',
          },
        },
      }
      expect(toErrorMessage(error)).toBe('message value')
    })

    it('handles empty/whitespace strings', () => {
      expect(toErrorMessage('')).toBe('未知错误')
      expect(toErrorMessage('   ')).toBe('未知错误')
      expect(toErrorMessage(new Error(''))).toBe('未知错误')
      expect(toErrorMessage(new Error('   '))).toBe('未知错误')
    })
    ```
```
</details>

<details>
<summary>GMN review</summary>

```text
# Review (GMN)

PR: 265
Round: 2

## Summary

P0: 0
P1: 0
P2: 2
P3: 0

## Findings

- id: GMN-001
  priority: P2
  category: quality
  file: apps/admin-front/src/app/(protected)/data-pull-tasks/page.tsx
  line: 293
  title: Duplicate error handling logic
  description: The methods `handleSubmit`, `handleTrigger`, and `handleInterrupt` contain verbose inline error extraction logic that duplicates the new `toErrorMessage` utility.
  suggestion: Replace the manual error extraction blocks with `toErrorMessage(error)` from `@/lib/bulk-action` to improve readability and consistency. For example, in `handleInterrupt`: `message.error(toErrorMessage(error))` instead of the complex ternary operation.

- id: GMN-002
  priority: P2
  category: architecture
  file: apps/admin-front/package.json
  line: 31
  title: Missing jest-environment-jsdom dependency
  description: `jest.config.ts` specifies `testEnvironment: 'jsdom'`, but `jest-environment-jsdom` is missing from `apps/admin-front/package.json` devDependencies. While it might be hoisted from the root, it should be explicit.
  suggestion: Add `jest-environment-jsdom` to `devDependencies`.
```
</details>
