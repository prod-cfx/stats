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

移动端对齐基线（screen graph、登录态策略、bottom sheet 边界、API 配置入口命名、设计 token 路径）见 `docs/decisions.md` 中「移动端设计对齐基线」（#1662）一节；底部 Tab 顺序、`数据→行情` 命名、冷启动 / 游客 / `/me` 守卫、route↔sheet 边界相对 `proto.jsx` 的差异判定见同文件「移动端设计基线复核」（#1749）一节。行情二级入口（聚合挂单 / 预测市场 / 币股）暂缓、标记 future 的归属结论见同文件「行情二级入口归属」（#1750）一节。后续 PR 基于该基线落地 token / 组件 / 路由，子任务对齐时直接引用，不重复解释同一组差异。

## 与仓库其他 app 的关系

- 不接入 Nx workspace，不通过 `dx` 命令编排，所有移动端命令直接使用 `flutter` CLI。
- 应用内的 API 调用本期走 mock，真实后端接入将在后续 issue 处理。
- bundle id：`com.alphanet.quantify.mobile`（iOS / Android 一致）。
