# quantify-mobile

[![quantify-mobile CI](https://github.com/AlphaNet7ed/stats/actions/workflows/quantify-mobile.yml/badge.svg?branch=main)](https://github.com/AlphaNet7ed/stats/actions/workflows/quantify-mobile.yml)

Quantify 项目的移动端 Flutter 工程，独立于 monorepo 的 Nx/dx 工具链，沿用裸 Flutter CLI。

## 环境要求

- Flutter `>=3.41.0`（含 Dart `>=3.11.5`）
- iOS：Xcode 15+ / CocoaPods（仅在 macOS 开发机或 CI 上构建 iOS）
- Android：Android Studio + JDK 17+ / Android SDK 34+

## 常用命令

```bash
cd apps/quantify-mobile

# 拉取依赖
flutter pub get

# 静态检查
flutter analyze

# 运行单元 / widget 测试
flutter test

# 启动 debug 应用（需要先连模拟器或物理设备）
flutter run
```

## 设计真源

UI / 交互设计稿位于仓库根 `design/project/mobile/Quantify Mobile App.html`，包含 16 屏高保真原型：

- `m-screens-*.jsx`（5 个屏幕组）
- `m-shell.jsx`（外壳布局）
- `ios-frame.jsx`（iOS 外框）
- `proto.jsx`（screen graph 与交互连线）

设计 token 真源位于上一层目录 `design/project/tokens.css`（被 `Quantify Mobile App.html` 通过 `../tokens.css` 引用），不在 `design/project/mobile/` 内重复一份。落地时统一引用该路径，避免拷贝漂移。

移动端对齐基线（screen graph、登录态策略、bottom sheet 边界、API 配置入口命名、设计 token 路径）见 `docs/decisions.md` 中「移动端设计对齐基线」（#1662）一节；底部 Tab 顺序、`数据→行情` 命名、冷启动 / 游客 / `/me` 守卫、route↔sheet 边界相对 `proto.jsx` 的差异判定见同文件「移动端设计基线复核」（#1749）一节。行情二级入口（聚合挂单 / 预测市场 / 币股）暂缓、标记 future 的归属结论见同文件「行情二级入口归属」（#1750）一节。API 配置唯一入口（我的页 + 部署引导 → `showApiFormSheet`，无 `/me/api` 列表页）、表单字段 / 授权权限 / 保存反馈以 app 为准、env/wallet/passphrase 标 future 的对齐结论见同文件「API 配置入口与授权表单设计对齐」（#1756）一节。AI 链路「确认策略 / 策略脚本」显式步骤页与 5 步 StepBar、市场类型 / 杠杆选择器采纳方案 B 暂缓、标记 future（维持 AI 对话 → `/ai/backtest-config` → 聊天内回测卡片的隐式覆盖边界）的结论见同文件「AI 链路「确认策略 / 策略脚本」步骤页：方案 B 暂缓」（#1770）一节。回测中 / 回测结果独立页（进度环 / 引擎日志 / 三标签页 / AI 评估 banner）与多维结果指标（CAGR/Calmar/胜率/盈亏比/平均持仓时长）暂缓、标记 future，维持聊天内卡片形态的取舍结论见同文件「回测中 / 回测结果独立页与结果维度补齐」（#1771）一节。登录认证方式以 app 邮箱+密码为唯一基线、设计稿 `ScreenLogin` 邮箱+验证码形态（发送验证码 / 60s 倒计时 / 重发）标历史/future、差异关闭的结论见同文件「登录认证方式基线」（#1788）一节。巨鲸地址详情 6 tab 重型详情（基本信息/现货/永续/挂单/成交/历史 + P&L 曲线图 + 4 stat 卡 + 永续持仓明细）已基于 #1858（PR #1864）落地的数据底座（11 个明细模型 + fixtures + l10n）采纳方案 A mock-first 落地（`whale_profile_page.dart` 6 tab + `WhalePnlChart` / `WhaleStatCards` / `WhalePerpSummaryCard`，统计弹窗 #1859 入口迁至 topbar 按钮，真实读路径 #1682 接入仅换 repository），决策反转结论 supersede 原暂缓节，见同文件「巨鲸地址详情 6 tab 重型详情落地：决策反转为方案 A」（#1791）一节。交易详情顶栏数据来源切换（聚合/Binance/OKX 下拉）采纳方案 B 暂缓、标记 future（维持顶栏固定「永续 · Binance」副标题），关联数据依赖 #1750（聚合订单簿数据范畴）+ #1683（实时推流通道）的取舍结论见同文件「交易详情数据来源切换（聚合/Binance/OKX）：暂缓、标 future」（#1794）一节。搜索体验基线（行情列表 market 内联搜索框 + symbol 过滤 / 多空比 long-short 无独立搜索 / 巨鲸实时 whale-live 资产 chip filter，巨鲸搜索以 #1754 `WhaleSearchSheet` 为唯一基线）维持现状、设计稿三屏全屏 search overlay（热门+历史 chips）采纳方案 B 暂缓标记 future，关联热门/历史数据依赖 #1682 的取舍结论见同文件「搜索体验基线」（#1797）一节。策略详情「用户评价」区块对齐设计稿（`m-screens-2.jsx` `StratDetail` 已 `{/* reviews removed */}`）移除（删 provider/section/`_ReviewsSection`/`StrategyReview` 模型/`listReviews` mock + 文案）的结论见同文件「策略详情「用户评价」区块移除」（#1799）一节。AI 量化整体形态裁决——维持现有对话中心形态（对话 → `/ai/confirm` → `/ai/backtest-config` → 聊天内回测卡 → `QzDeploySheet`）为最终基线，设计稿 6 屏线性向导 + 5 步 `BtcStepBar`（`m-screens-btconfig.jsx:285`）+ 屏间「上一步/下一步」线性导航采纳方案 B 暂缓、统一标记 future（依赖真实策略生成/回测 #1679/#1682 未就绪），本结论作为后续所有「AI 量化」单屏对齐 Issue 的形态前置依据的结论见同文件「AI 量化形态裁决 + 5 步 StepBar 向导骨架：方案 B 维持对话中心、向导标 future」（#1890）一节。后续 PR 基于该基线落地 token / 组件 / 路由，子任务对齐时直接引用，不重复解释同一组差异。

## 与仓库其他 app 的关系

- 不接入 Nx workspace，不通过 `dx` 命令编排，所有移动端命令直接使用 `flutter` CLI。
- 应用内的 API 调用本期走 mock，真实后端接入将在后续 issue 处理。
- bundle id：`com.alphanet.quantify.mobile`（iOS / Android 一致）。
