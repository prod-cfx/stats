# quantify-mobile 品牌资源（图标 / 启动屏）

## 源资源

所有源资源位于 `apps/quantify-mobile/assets/branding/`：

| 文件 | 尺寸 | 用途 |
|------|------|------|
| `app_icon.png` | 1024×1024 | iOS / Android 应用图标源；由 `flutter_launcher_icons` 派生全平台尺寸 |
| `splash_logo.png` | 512×512 | 启动屏中央 logo（透明背景） |
| `splash_background.png` | 1080×1920 | 启动屏全屏渐变底图（垂直 `#0B0F17` → `#1A2440`） |

## 品牌色 token

- 主背景 / 应用底色：`#0B0F17`（深炭蓝，与 `lib/theme/colors.dart` 中 `bgPrimary` 对齐）
- Accent / 标识色：`#5B8DEF`（蓝紫，与 design token `accent.primary` 对齐）
- 启动屏渐变末端：`#1A2440`（accent deep，用于背景过渡）

## 重生成命令（设计师替换 PNG 后执行）

> **前提**：需要 Android Studio + Android SDK（Android 部分）和 macOS + Xcode（iOS 部分）。
> 纯沙箱 / CI 容器环境只能替换 `assets/branding/` 下的源 PNG；
> 下面两条 `dart run` 必须在具备 SDK 的机器上执行，否则会报 `SDK not found` 中止。

```bash
cd apps/quantify-mobile
flutter pub get
dart run flutter_launcher_icons      # 重生成 Android mipmap-* + iOS AppIcon.appiconset
dart run flutter_native_splash:create # 重生成 launch_background.xml / styles.xml / LaunchImage.imageset
flutter analyze
flutter test
```

## 平台差异（启动屏）

- **Android**：使用渐变底图 `splash_background.png`（gravity=fill）+ 居中 `splash_logo.png`；Android 12+ 走 Splash Screen API，`windowSplashScreenAnimatedIcon` 使用 `splash_logo.png`，`windowSplashScreenBackground` 走 `#0B0F17`
- **iOS**：`flutter_native_splash` 对 iOS 的 `background_image` 处理为纯色采样（不渲染渐变图），实际启动屏为 `#0B0F17` 纯色底 + 居中 `splash_logo.png`；如需 iOS 渐变效果，需手工把 1080×1920 渐变 PNG 拷贝到 `ios/Runner/Assets.xcassets/LaunchBackground.imageset/background.png` 并补 2x/3x 资源

## 沙箱降级方案

CI 沙箱无 ImageMagick / 字体时，本仓库使用 Python Pillow 生成最小几何 PNG（见 `scripts/` 或 PR body 嵌入脚本）：

```python
from PIL import Image, ImageDraw

def round_rect(img, box, radius, fill):
    ImageDraw.Draw(img).rounded_rectangle(box, radius=radius, fill=fill)

icon = Image.new("RGBA", (1024, 1024), (11, 15, 23, 255))
round_rect(icon, (256, 256, 768, 768), 80, (91, 141, 239, 255))
icon.save("assets/branding/app_icon.png")
```

设计师交付正式 SVG / PNG 后，直接替换 `assets/branding/` 下同名文件即可。

## 配置位置

- 图标配置：`pubspec.yaml` 顶层 `flutter_launcher_icons:` 段
  - `android: true` / `ios: true`
  - `image_path: assets/branding/app_icon.png`
  - `adaptive_icon_background: "#0B0F17"`
  - `adaptive_icon_foreground: assets/branding/app_icon.png`
  - `remove_alpha_ios: true`（iOS 不支持 alpha）
- 启动屏配置：`pubspec.yaml` 顶层 `flutter_native_splash:` 段
  - `color: "#0B0F17"`（无渐变兜底）
  - `image: assets/branding/splash_logo.png`（中央 logo）
  - `background_image: assets/branding/splash_background.png`（渐变底图）
  - `android_12:` 子段独立配置 Android 12+ Splash Screen API

## 产物覆盖范围

`flutter_launcher_icons` 改写：

- `android/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/launcher_icon.png` + `ic_launcher.png`
- `android/app/src/main/res/mipmap-anydpi-v26/launcher_icon.xml`（adaptive icon）
- `android/app/src/main/res/values/colors.xml` 新增 `ic_launcher_background`
- `ios/Runner/Assets.xcassets/AppIcon.appiconset/*.png` 全套尺寸 + `Contents.json`

`flutter_native_splash:create` 改写：

- `android/app/src/main/res/drawable[-v21]/launch_background.xml`
- `android/app/src/main/res/values[-night][-v31]/styles.xml`
- `ios/Runner/Assets.xcassets/LaunchImage.imageset/*.png`
- `ios/Runner/Info.plist`（状态栏可见性）

## 维护节奏

- 品牌色变更：先改 `lib/theme/colors.dart` token；同步本文件 + pubspec 顶层 launcher_icons/native_splash 配置；重跑两条 `dart run` 命令
- 图标版本号变更：替换 `assets/branding/app_icon.png` 即可，文件名保持不变
- 启动屏渐变变更：替换 `splash_background.png`；不要在 `flutter_native_splash:` 中使用 `gradient:` 字段（该字段已废弃，推荐用 `background_image` 路径）
