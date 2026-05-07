# AI Quant 我的策略分类 Tab 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `account?tab=ai-quant` 页 `我的策略` 列表上方新增互斥四分类 tab（全部 / 运行中 / 已停止 / 历史记录），前端过滤、不改后端。

**Architecture:** 在 `AiQuantStrategyList` 组件内引入 `activeTab` state 与 `filteredStrategies` / `counts` 派生量；新增同文件子组件 `StrategyFilterTabs` 渲染 tab 栏。`fetchAccountAiQuantStrategies` 一次拉 `limit=200`，不带 `status` 参数；切 tab 仅切派生数据。空态分支：`strategies.length===0` 走原大空态卡，`filteredStrategies.length===0` 走单 tab 小提示。

**Tech Stack:** React 19 + Next.js 16 + TypeScript + Tailwind + react-i18next + Jest（jsdom）

参考 spec：`docs/superpowers/specs/2026-05-07-ai-quant-strategy-filter-tabs-design.md`

---

## 文件结构

- 修改 `apps/front/src/components/account/AiQuantStrategyList.tsx`
  - 新增 `TabKey` 类型与导出函数 `filterStrategiesByTab` / `computeTabCounts`（便于单测复用）
  - 新增同文件子组件 `StrategyFilterTabs`
  - `loadStrategies` 中 `limit: 20 → 200`
  - 调整空态分支
- 修改 `apps/front/public/locales/zh/common.json`：在 `aiQuant` 节点下追加 `filter` 子对象
- 修改 `apps/front/public/locales/en/common.json`：同上
- 修改 `apps/front/src/components/account/ai-quant-strategy-list.test.ts`：补 6 个 case

---

### Task 1：新增分类纯函数 + 单测

**Files:**
- Modify: `apps/front/src/components/account/AiQuantStrategyList.tsx`（在文件顶部 import 之后、`fmtTime` 之前新增导出）
- Test: `apps/front/src/components/account/ai-quant-strategy-list.test.ts`

#### Step 1: 写失败测试

- [ ] 在 `apps/front/src/components/account/ai-quant-strategy-list.test.ts` 末尾追加：

```ts
describe('filterStrategiesByTab / computeTabCounts', () => {
  const running = makeListRecord({ id: 'r', status: 'running', viewOnlyAt: null })
  const stopped = makeListRecord({ id: 's', status: 'stopped', viewOnlyAt: null })
  const historyStopped = makeListRecord({ id: 'h1', status: 'stopped', viewOnlyAt: '2026-04-01T00:00:00.000Z' })
  const historyRunning = makeListRecord({ id: 'h2', status: 'running', viewOnlyAt: '2026-04-02T00:00:00.000Z' })
  const all = [running, stopped, historyStopped, historyRunning]

  it('all tab excludes view-only', async () => {
    const { filterStrategiesByTab } = await import('./AiQuantStrategyList')
    expect(filterStrategiesByTab(all, 'all').map(x => x.id)).toEqual(['r', 's'])
  })

  it('running tab excludes view-only running', async () => {
    const { filterStrategiesByTab } = await import('./AiQuantStrategyList')
    expect(filterStrategiesByTab(all, 'running').map(x => x.id)).toEqual(['r'])
  })

  it('stopped tab excludes view-only stopped', async () => {
    const { filterStrategiesByTab } = await import('./AiQuantStrategyList')
    expect(filterStrategiesByTab(all, 'stopped').map(x => x.id)).toEqual(['s'])
  })

  it('history tab includes any viewOnlyAt non-null', async () => {
    const { filterStrategiesByTab } = await import('./AiQuantStrategyList')
    expect(filterStrategiesByTab(all, 'history').map(x => x.id).sort()).toEqual(['h1', 'h2'])
  })

  it('computeTabCounts splits all = running + stopped, history independent', async () => {
    const { computeTabCounts } = await import('./AiQuantStrategyList')
    expect(computeTabCounts(all)).toEqual({ all: 2, running: 1, stopped: 1, history: 2 })
  })
})
```

> 同时在 `makeListRecord` 默认对象里补 `viewOnlyAt: null` 字段（与运行时一致），并在 `Partial<AiQuantStrategyRecord>` overrides 中允许覆盖。

#### Step 2: 运行测试，确认失败

- [ ] 运行：

```bash
dx test unit front --testPathPattern ai-quant-strategy-list
```

期望：`filterStrategiesByTab is not a function` / `computeTabCounts is not a function`，5 个新增 case 全部 FAIL。

#### Step 3: 实现纯函数

- [ ] 在 `AiQuantStrategyList.tsx` 顶部 imports 之后、`fmtTime` 之前插入：

```ts
export type StrategyFilterTabKey = 'all' | 'running' | 'stopped' | 'history'

export interface StrategyFilterCounts {
  all: number
  running: number
  stopped: number
  history: number
}

function isHistory(item: Pick<AiQuantStrategyRecord, 'viewOnlyAt'>): boolean {
  return Boolean(item.viewOnlyAt)
}

export function filterStrategiesByTab(
  items: AiQuantStrategyRecord[],
  tab: StrategyFilterTabKey,
): AiQuantStrategyRecord[] {
  switch (tab) {
    case 'all':
      return items.filter(item => !isHistory(item))
    case 'running':
      return items.filter(item => !isHistory(item) && item.status === 'running')
    case 'stopped':
      return items.filter(item => !isHistory(item) && item.status === 'stopped')
    case 'history':
      return items.filter(isHistory)
  }
}

export function computeTabCounts(items: AiQuantStrategyRecord[]): StrategyFilterCounts {
  let running = 0
  let stopped = 0
  let history = 0
  for (const item of items) {
    if (isHistory(item)) {
      history++
      continue
    }
    if (item.status === 'running') running++
    else if (item.status === 'stopped') stopped++
  }
  return { all: running + stopped, running, stopped, history }
}
```

#### Step 4: 跑测试，确认通过

- [ ] 运行：

```bash
dx test unit front --testPathPattern ai-quant-strategy-list
```

期望：5 个新增 case PASS，旧 case 不受影响。

#### Step 5: 提交

- [ ] 提交：

```bash
git add apps/front/src/components/account/AiQuantStrategyList.tsx \
  apps/front/src/components/account/ai-quant-strategy-list.test.ts
git commit -F - <<'MSG'
feat(ai-quant): 新增策略列表分类纯函数 filterStrategiesByTab / computeTabCounts

互斥四分类：全部 / 运行中 / 已停止 / 历史记录；历史记录 = viewOnlyAt 非空。

Refs: #ai-quant-strategy-filter-tabs
MSG
```

---

### Task 2：补 i18n 文案

**Files:**
- Modify: `apps/front/public/locales/zh/common.json`（在 `aiQuant.myStrategies` 同级新增 `filter` 对象）
- Modify: `apps/front/public/locales/en/common.json`（同上）

#### Step 1: 中文文案

- [ ] 打开 `apps/front/public/locales/zh/common.json`，在 `"myStrategies": "我的策略"` 下方追加：

```json
    "myStrategies": "我的策略",
    "filter": {
      "all": "全部",
      "running": "运行中",
      "stopped": "已停止",
      "history": "历史记录",
      "emptyForTab": "当前分类下暂无策略"
    },
```

注意保留原有的逗号语法（`myStrategies` 行原本结尾是 `,`，新增 `filter` 后面也跟 `,`）。

#### Step 2: 英文文案

- [ ] 打开 `apps/front/public/locales/en/common.json`，在 `myStrategies` 同级追加：

```json
    "filter": {
      "all": "Active",
      "running": "Running",
      "stopped": "Stopped",
      "history": "History",
      "emptyForTab": "No strategies in this category"
    },
```

如果 en 文件里没有 `myStrategies` 节点，在 `aiQuant` 下与现有同层级 key 平行追加即可。

#### Step 3: 验证 JSON 合法

- [ ] 运行：

```bash
node -e "require('./apps/front/public/locales/zh/common.json'); require('./apps/front/public/locales/en/common.json'); console.log('ok')"
```

期望输出：`ok`。

#### Step 4: 提交

- [ ] 提交：

```bash
git add apps/front/public/locales/zh/common.json apps/front/public/locales/en/common.json
git commit -F - <<'MSG'
feat(ai-quant): 新增 myStrategies 分类 tab 国际化文案

Refs: #ai-quant-strategy-filter-tabs
MSG
```

---

### Task 3：扩大列表请求 limit 到 200

**Files:**
- Modify: `apps/front/src/components/account/AiQuantStrategyList.tsx:117-122`（`loadStrategies` 内部）

#### Step 1: 改写失败测试

- [ ] 在 `ai-quant-strategy-list.test.ts` 内已有的"requests strategies on mount"类用例（如不存在则新增）添加断言：

```ts
it('requests strategies with limit=200 on mount', async () => {
  mockSession = { userId: 'u1' }
  mockFetchAccountAiQuantStrategies.mockResolvedValue({ items: [], total: 0, page: 1, limit: 200 })
  await act(async () => {
    root.render(React.createElement(AiQuantStrategyList, { lng: 'zh' }))
  })
  expect(mockFetchAccountAiQuantStrategies).toHaveBeenCalledWith({ userId: 'u1', page: 1, limit: 200 })
})
```

#### Step 2: 跑测试，确认失败

- [ ] 运行：

```bash
dx test unit front --testPathPattern ai-quant-strategy-list -t "limit=200"
```

期望：FAIL（当前是 `limit: 20`）。

#### Step 3: 改 limit

- [ ] 在 `AiQuantStrategyList.tsx` `loadStrategies` 中：

```ts
const response = await fetchAccountAiQuantStrategies({
  userId: session.userId,
  page: 1,
  limit: 200,
})
```

#### Step 4: 跑测试，确认通过

- [ ] 运行：

```bash
dx test unit front --testPathPattern ai-quant-strategy-list -t "limit=200"
```

期望：PASS。

#### Step 5: 提交

- [ ] 提交：

```bash
git add apps/front/src/components/account/AiQuantStrategyList.tsx \
  apps/front/src/components/account/ai-quant-strategy-list.test.ts
git commit -F - <<'MSG'
feat(ai-quant): 我的策略列表请求 limit 由 20 提到 200 以支持前端分类过滤

Refs: #ai-quant-strategy-filter-tabs
MSG
```

---

### Task 4：渲染 tab 栏 + 切 tab 行为

**Files:**
- Modify: `apps/front/src/components/account/AiQuantStrategyList.tsx`

#### Step 1: 写失败测试

- [ ] 在测试文件末尾新增 describe block：

```ts
describe('AiQuantStrategyList tabs UI', () => {
  function listItem(over: Partial<AiQuantStrategyRecord> = {}) {
    return makeListRecord({ id: over.id ?? Math.random().toString(36).slice(2), ...over })
  }

  beforeEach(() => {
    mockSession = { userId: 'u1' }
  })

  it('renders four tabs with counts and defaults to all', async () => {
    mockFetchAccountAiQuantStrategies.mockResolvedValue({
      items: [
        listItem({ id: 'r1', status: 'running', viewOnlyAt: null }),
        listItem({ id: 's1', status: 'stopped', viewOnlyAt: null }),
        listItem({ id: 's2', status: 'stopped', viewOnlyAt: null }),
        listItem({ id: 'h1', status: 'stopped', viewOnlyAt: '2026-04-01T00:00:00.000Z' }),
      ],
      total: 4, page: 1, limit: 200,
    })
    await act(async () => {
      root.render(React.createElement(AiQuantStrategyList, { lng: 'zh' }))
    })
    await act(async () => { await Promise.resolve() })

    const tabs = container.querySelectorAll('[data-testid^="strategy-filter-tab-"]')
    expect(tabs.length).toBe(4)
    const counts = Array.from(tabs).map(el => el.getAttribute('data-count'))
    expect(counts).toEqual(['3', '1', '2', '1']) // all=3, running=1, stopped=2, history=1

    const active = container.querySelector('[data-testid^="strategy-filter-tab-"][data-active="true"]')
    expect(active?.getAttribute('data-testid')).toBe('strategy-filter-tab-all')
  })

  it('clicking a tab filters list to that category', async () => {
    mockFetchAccountAiQuantStrategies.mockResolvedValue({
      items: [
        listItem({ id: 'r1', status: 'running', viewOnlyAt: null, name: 'R1' }),
        listItem({ id: 's1', status: 'stopped', viewOnlyAt: null, name: 'S1' }),
        listItem({ id: 'h1', status: 'stopped', viewOnlyAt: '2026-04-01T00:00:00.000Z', name: 'H1' }),
      ],
      total: 3, page: 1, limit: 200,
    })
    await act(async () => {
      root.render(React.createElement(AiQuantStrategyList, { lng: 'zh' }))
    })
    await act(async () => { await Promise.resolve() })

    await act(async () => {
      ;(container.querySelector('[data-testid="strategy-filter-tab-history"]') as HTMLButtonElement).click()
    })

    const titles = Array.from(container.querySelectorAll('h4')).map(n => n.textContent)
    expect(titles).toEqual(['H1'])
  })
})
```

#### Step 2: 跑测试，确认失败

- [ ] 运行：

```bash
dx test unit front --testPathPattern ai-quant-strategy-list -t "tabs UI"
```

期望：FAIL（找不到 `strategy-filter-tab-*` 元素）。

#### Step 3: 实现 tab 栏与状态

- [ ] 在 `AiQuantStrategyList.tsx` 中：

  1. 顶部 imports 中追加 `import { useMemo } from 'react'`（合并到既有 react import）
  2. 在 `fmtTime` 下方、`buildParamSummary` 之上新增 `StrategyFilterTabs` 组件：

```tsx
const TAB_ORDER: StrategyFilterTabKey[] = ['all', 'running', 'stopped', 'history']

function StrategyFilterTabs({
  active,
  counts,
  onChange,
  t,
}: {
  active: StrategyFilterTabKey
  counts: StrategyFilterCounts
  onChange: (next: StrategyFilterTabKey) => void
  t: (key: string, options?: { defaultValue?: string }) => string
}) {
  return (
    <div className="flex items-center gap-1 border-b border-[color:var(--cf-border)] px-1">
      {TAB_ORDER.map((key) => {
        const isActive = key === active
        return (
          <button
            key={key}
            type="button"
            data-testid={`strategy-filter-tab-${key}`}
            data-active={isActive ? 'true' : 'false'}
            data-count={counts[key]}
            onClick={() => onChange(key)}
            className={`-mb-px flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
              isActive
                ? 'border-b-2 border-primary font-semibold text-[color:var(--cf-text-strong)]'
                : 'border-b-2 border-transparent text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'
            }`}
          >
            <span>{t(`aiQuant.filter.${key}`)}</span>
            <span className="rounded-full bg-[color:var(--cf-surface)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--cf-muted)] border border-[color:var(--cf-border)]">
              {counts[key]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
```

  3. 在 `AiQuantStrategyList` 函数体内、`useState` 队列后追加：

```ts
const [activeTab, setActiveTab] = useState<StrategyFilterTabKey>('all')
const counts = useMemo(() => computeTabCounts(strategies), [strategies])
const filteredStrategies = useMemo(() => filterStrategiesByTab(strategies, activeTab), [strategies, activeTab])
```

  4. 在最终的 return 中（即 `strategies.length > 0` 分支）：
    - 把原来 `strategies.map(item => ...)` 改为 `filteredStrategies.map(item => ...)`
    - 在 `<h3>...</h3>` 头部下方插入：

```tsx
<StrategyFilterTabs active={activeTab} counts={counts} onChange={setActiveTab} t={t} />
```

#### Step 4: 跑测试，确认通过

- [ ] 运行：

```bash
dx test unit front --testPathPattern ai-quant-strategy-list -t "tabs UI"
```

期望：PASS。

#### Step 5: 提交

- [ ] 提交：

```bash
git add apps/front/src/components/account/AiQuantStrategyList.tsx \
  apps/front/src/components/account/ai-quant-strategy-list.test.ts
git commit -F - <<'MSG'
feat(ai-quant): 我的策略列表新增分类 tab 栏（全部 / 运行中 / 已停止 / 历史记录）

- 默认选中「全部」（不含 viewOnly 的历史记录）
- 切 tab 仅切派生数据，不发请求
- 每个 tab 带数量徽章

Refs: #ai-quant-strategy-filter-tabs
MSG
```

---

### Task 5：单 tab 空态文案

**Files:**
- Modify: `apps/front/src/components/account/AiQuantStrategyList.tsx`

#### Step 1: 写失败测试

- [ ] 在 `tabs UI` describe 中追加：

```ts
it('shows emptyForTab hint when filtered list is empty but strategies are not', async () => {
  mockFetchAccountAiQuantStrategies.mockResolvedValue({
    items: [listItem({ id: 'r1', status: 'running', viewOnlyAt: null })],
    total: 1, page: 1, limit: 200,
  })
  await act(async () => {
    root.render(React.createElement(AiQuantStrategyList, { lng: 'zh' }))
  })
  await act(async () => { await Promise.resolve() })

  await act(async () => {
    ;(container.querySelector('[data-testid="strategy-filter-tab-history"]') as HTMLButtonElement).click()
  })

  expect(container.querySelector('[data-testid="strategy-filter-empty"]')).not.toBeNull()
  // big empty state CTA must NOT render
  expect(container.textContent).not.toContain('aiQuant.createStrategy')
})

it('still shows large empty state when there are zero strategies', async () => {
  mockFetchAccountAiQuantStrategies.mockResolvedValue({ items: [], total: 0, page: 1, limit: 200 })
  await act(async () => {
    root.render(React.createElement(AiQuantStrategyList, { lng: 'zh' }))
  })
  await act(async () => { await Promise.resolve() })

  expect(container.querySelector('[data-testid="strategy-filter-empty"]')).toBeNull()
  // tab bar should not render
  expect(container.querySelector('[data-testid^="strategy-filter-tab-"]')).toBeNull()
})
```

#### Step 2: 跑测试，确认失败

- [ ] 运行：

```bash
dx test unit front --testPathPattern ai-quant-strategy-list -t "emptyForTab"
```

期望：FAIL（当前没有 `strategy-filter-empty`，且单 tab 空态会渲染 0 行）。

#### Step 3: 实现单 tab 空态分支

- [ ] 在 `AiQuantStrategyList.tsx` 列表渲染区调整：把现有的：

```tsx
<div className="space-y-3">
  {filteredStrategies.map(item => { ... })}
</div>
```

改为：

```tsx
{filteredStrategies.length === 0 ? (
  <div
    data-testid="strategy-filter-empty"
    className="rounded-xl border border-dashed border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-4 py-8 text-center text-sm text-[color:var(--cf-muted)]"
  >
    {t('aiQuant.filter.emptyForTab', { defaultValue: '当前分类下暂无策略' })}
  </div>
) : (
  <div className="space-y-3">
    {filteredStrategies.map(item => { ... })}
  </div>
)}
```

> `strategies.length === 0` 时仍走原有大空态分支（不变），不会渲染 tab 栏。

#### Step 4: 跑测试，确认通过

- [ ] 运行：

```bash
dx test unit front --testPathPattern ai-quant-strategy-list
```

期望：所有用例（包括 Task 1/3/4/5 新增的）PASS。

#### Step 5: 提交

- [ ] 提交：

```bash
git add apps/front/src/components/account/AiQuantStrategyList.tsx \
  apps/front/src/components/account/ai-quant-strategy-list.test.ts
git commit -F - <<'MSG'
feat(ai-quant): 单 tab 空态展示「当前分类下暂无策略」小提示

完全没有策略时仍走原大空态卡（含创建 CTA）。

Refs: #ai-quant-strategy-filter-tabs
MSG
```

---

### Task 6：联调验证 + 顶层 lint / build

**Files:** 无新增改动；只跑命令并验证。

#### Step 1: lint

- [ ] 运行：

```bash
dx lint
```

期望：0 error。如有 warning 与本次改动相关，按提示修复后再次运行直至通过。

#### Step 2: 前端单测

- [ ] 运行：

```bash
dx test unit front
```

期望：全部 PASS（含本次 6 个新 case 与原有 case）。

#### Step 3: 前端构建

- [ ] 运行：

```bash
dx build front --dev
```

期望：构建成功。

#### Step 4: 提交（仅在前 3 步如果触发了任何 lint 自动修复 / 类型修补时才需要）

- [ ] 仅当有变更：

```bash
git add -A
git commit -F - <<'MSG'
chore(ai-quant): lint 与构建通过

Refs: #ai-quant-strategy-filter-tabs
MSG
```

否则跳过本步。

---

## 自检（Self-Review）

- 全部 spec 要点已落到任务：
  - 互斥四分类定义 → Task 1（纯函数）+ Task 4（UI）
  - `limit=20 → 200` → Task 3
  - i18n key → Task 2
  - tab 栏 + 计数徽章 + 默认 all → Task 4
  - 空态分支（全空 vs 单 tab 空）→ Task 5（叠加 Task 4 中保留的原大空态分支）
  - 测试用例：filter 函数 4 项 + counts 1 项 + tab UI 2 项 + 空态 2 项 + limit=200 1 项 → 共 10 项，覆盖 spec 中列的 6 类断言
- 无 TBD / TODO / "类似 Task N" 等占位
- 类型一致：`StrategyFilterTabKey`、`StrategyFilterCounts`、`filterStrategiesByTab`、`computeTabCounts`、`StrategyFilterTabs`、testid `strategy-filter-tab-{key}` / `strategy-filter-empty` 在所有任务中保持同名
