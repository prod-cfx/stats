import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../l10n/app_localizations.dart';
import '../../../theme/tokens.dart';

/// 「我的」页面顶部紫色 header（原型 `m-screens-4.jsx:944-989`）。
///
/// 内容：左侧 64x64 头像 placeholder + 右侧 email（脱敏）+ UID（mono 小字）
/// + 右侧复制按钮；下方两个 chip（Telegram 已绑定 / Binance ✓）。
///
/// header 自带 accent 渐变，**不读 context.qzScheme** —— 主题切换时不破坏，
/// 因为它是「品牌区」固定深紫，与 `m-screens-4.jsx:944-949` radial+linear
/// 渐变一致。
class QzAccountHeader extends StatelessWidget {
  const QzAccountHeader({
    super.key,
    required this.maskedEmail,
    required this.uid,
    this.telegramBound = false,
    this.binanceConnected = false,
  });

  final String maskedEmail;
  final String uid;
  final bool telegramBound;
  final bool binanceConnected;

  // 底层对角线性渐变（设计稿 linear-gradient(160deg, #1F0F4A, #2E1A6B)）。
  static const LinearGradient _baseGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: <Color>[Color(0xFF1F0F4A), Color(0xFF2E1A6B)],
  );

  // 右上紫晕：radial-gradient(at 88% 16%, rgba(167,139,250,0.4) → transparent)。
  // 百分比换算到 Alignment(-1..1)：88%→0.76，16%→-0.68。
  static const RadialGradient _topRightGlow = RadialGradient(
    center: Alignment(0.76, -0.68),
    radius: 0.9,
    colors: <Color>[Color(0x66A78BFA), Color(0x00A78BFA)],
    stops: <double>[0, 0.6],
  );

  // 左下紫晕：radial-gradient(at 10% 90%, rgba(124,92,255,0.3) → transparent)。
  // 10%→-0.8，90%→0.8。
  static const RadialGradient _bottomLeftGlow = RadialGradient(
    center: Alignment(-0.8, 0.8),
    radius: 0.9,
    colors: <Color>[Color(0x4D7C5CFF), Color(0x007C5CFF)],
    stops: <double>[0, 0.6],
  );

  @override
  Widget build(BuildContext context) {
    // 设计稿顶距 62px 含状态栏；这里用状态栏占位 + 基础留白，避免文字被遮挡。
    final double topPadding = MediaQuery.of(context).padding.top + 20;
    return Stack(
      children: <Widget>[
        const Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(gradient: _baseGradient),
          ),
        ),
        const Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(gradient: _topRightGlow),
          ),
        ),
        const Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(gradient: _bottomLeftGlow),
          ),
        ),
        Container(
          padding: EdgeInsets.fromLTRB(20, topPadding, 20, 56),
          width: double.infinity,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  const _AvatarPlaceholder(),
                  const SizedBox(width: QzSpacing.md + 2),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        Text(
                          maskedEmail,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.2,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'UID · $uid',
                          style: const TextStyle(
                            color: Color(0x99FFFFFF),
                            fontSize: 11,
                            fontFamilyFallback: <String>[
                              'ui-monospace',
                              'monospace',
                            ],
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  // 复制按钮：点击 → Clipboard.setData(uid) → SnackBar 提示。
                  IconButton(
                    tooltip: AppLocalizations.of(context).meHeaderCopyUid,
                    onPressed: () async {
                      // 极少数情况 Clipboard API 会抛（权限拒绝 / 平台异常），
                      // 包 try/catch 避免未处理异常冒泡到 Flutter framework。
                      try {
                        await Clipboard.setData(ClipboardData(text: uid));
                      } catch (_) {
                        return;
                      }
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            AppLocalizations.of(context).meHeaderUidCopied,
                          ),
                          duration: const Duration(seconds: 2),
                        ),
                      );
                    },
                    style: IconButton.styleFrom(
                      backgroundColor: const Color(0x1FFFFFFF),
                      padding: EdgeInsets.zero,
                      minimumSize: const Size(32, 32),
                    ),
                    icon: const Icon(
                      Icons.copy,
                      size: 14,
                      color: Color(0xCCFFFFFF),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: <Widget>[
                  if (telegramBound)
                    _HeaderChip(
                      label: AppLocalizations.of(context).meHeaderTelegramBound,
                      showStatusDot: true,
                    ),
                  if (binanceConnected)
                    _HeaderChip(
                      label: AppLocalizations.of(
                        context,
                      ).meHeaderBinanceConnected,
                    ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// 「我的」header logo：设计稿为 3×3 彩色像素方块品牌标记
/// （`m-screens-4.jsx:2470-2480`，紫色系配色）。
///
/// 用 [CustomPainter] 画 3×3 彩格，避免为单个静态图形引入 `flutter_svg`。
/// 容器保持 56×56 / radius 16 的品牌区底，彩格绘制在内边距内，[ClipRRect]
/// 保证圆角不溢出。
class _AvatarPlaceholder extends StatelessWidget {
  const _AvatarPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        color: const Color(0x22FFFFFF),
        border: Border.all(color: const Color(0x2EFFFFFF)),
        borderRadius: BorderRadius.circular(16),
      ),
      alignment: Alignment.center,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: const SizedBox(
          width: 36,
          height: 36,
          child: CustomPaint(painter: _PixelLogoPainter()),
        ),
      ),
    );
  }
}

/// 3×3 彩色方块：配色取自设计稿 9 个 rect（紫色系），按行优先填充。
class _PixelLogoPainter extends CustomPainter {
  const _PixelLogoPainter();

  // 行优先：design `m-screens-4.jsx:2470-2480` 的 9 个 rect 填色。
  static const List<List<Color>> _palette = <List<Color>>[
    <Color>[Color(0xFFA78BFA), Color(0xFF7C5CFF), Color(0xFFC4B5FD)],
    <Color>[Color(0xFF7C5CFF), Color(0xFF5B21B6), Color(0xFFA78BFA)],
    <Color>[Color(0xFFC4B5FD), Color(0xFFA78BFA), Color(0xFF7C5CFF)],
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final double cell = size.width / 3;
    final Paint paint = Paint();
    for (int row = 0; row < 3; row++) {
      for (int col = 0; col < 3; col++) {
        paint.color = _palette[row][col];
        canvas.drawRect(
          Rect.fromLTWH(col * cell, row * cell, cell, cell),
          paint,
        );
      }
    }
  }

  @override
  bool shouldRepaint(_PixelLogoPainter oldDelegate) => false;
}

class _HeaderChip extends StatelessWidget {
  const _HeaderChip({required this.label, this.showStatusDot = false});
  final String label;

  /// 文字左侧绿色状态点（设计稿 Telegram chip `#16C783`，`m-screens-4.jsx:2497`）。
  final bool showStatusDot;

  @override
  Widget build(BuildContext context) {
    const TextStyle textStyle = TextStyle(
      color: Color(0xFFDDD6FE),
      fontSize: 11,
      fontWeight: FontWeight.w500,
    );
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.md,
        vertical: 6,
      ),
      decoration: BoxDecoration(
        color: const Color(0x24FFFFFF),
        border: Border.all(color: const Color(0x2EFFFFFF)),
        borderRadius: BorderRadius.circular(QzRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          if (showStatusDot) ...<Widget>[
            Container(
              width: 6,
              height: 6,
              decoration: const BoxDecoration(
                color: Color(0xFF16C783),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 6),
          ],
          Text(label, style: textStyle),
        ],
      ),
    );
  }
}
