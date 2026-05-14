# apps/front 移动端适配最终审计与收尾（#1352）

日期：2026-05-14

## 审计范围

- 视口：375x812、768x1024、1440x900
- 语言：中文、英文核心入口
- 主题：深色、浅色切换可达
- 路由：主页、AI 量化、策略广场、回测报告、账户 AI 量化、市场/交易、行情数据页、巨鲸跟踪、Dashboard 列表/查看/编辑
- 弹层/浮层：移动导航、语言切换、主题切换、通知铃铛、Dashboard 添加组件弹层

## 修复记录

- 修复 Dashboard 列表页和编辑页在移动端触发 `Maximum update depth exceeded` 的问题。
  - 根因：Dashboard 侧栏通过 `useSyncExternalStore` 返回新对象/数组快照，React 19 在订阅校验中持续判定快照变化。
  - 处理：改为事件驱动的本地 state 同步，保留 `coinflux_dashboards_updated` 和 `storage` 更新来源。
- 修复 Dashboard 编辑器移动端标题操作区挤压，导致“选择缩略图”等按钮文字竖排的问题。
  - 处理：Header 在小屏改为纵向排列，操作按钮允许换行并保持 `whitespace-nowrap`。

## 浏览器审计结果

- 375px：核心页面均可打开，无 `Oops` / `Maximum update depth exceeded`；Dashboard 编辑器按钮不再竖排。
- 768px：核心页面均可打开；鉴权页面显示登录态，不出现布局崩溃。
- 1440px：桌面视口未发现回归。
- 账户相关页面在未登录状态展示登录或空状态，属于当前环境预期。
- 浏览器插件不能执行页面 JS 读取 `scrollWidth`，本轮使用 DOM 快照、截图和现有移动端单测覆盖横向溢出风险。

## 验证

- `dx lint`
- `dx test unit front`
- `dx build front --dev`
- 当前 worktree 浏览器核验：`http://localhost:3012`

## 残留事项

- 未发现需要拆 follow-up 的阻塞问题。
- `dx start front --dev` 在本机 3001 端口曾被旧 worktree 进程占用，浏览器核验改用当前 worktree 的 3012 端口执行。
