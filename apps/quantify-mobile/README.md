# quantify-mobile

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
- `tokens.css`（设计 token）

后续 PR 将基于上述设计稿落地 token / 组件 / 路由。

## 与仓库其他 app 的关系

- 不接入 Nx workspace，不通过 `dx` 命令编排，所有移动端命令直接使用 `flutter` CLI。
- 应用内的 API 调用本期走 mock，真实后端接入将在后续 issue 处理。
- bundle id：`com.alphanet.quantify.mobile`（iOS / Android 一致）。
