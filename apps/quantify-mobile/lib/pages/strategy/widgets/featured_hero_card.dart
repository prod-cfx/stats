import 'package:flutter/material.dart';

import '../../../data/models/strategy_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_avatar.dart';
import 'sparkline_view.dart';

/// 「本周推荐」featured hero 卡（#1565）。
///
/// 紫色三段渐变背景 + 半透明 sparkline 装饰 + 标题/副标题 + 查看详情胶囊；
/// 对齐设计稿 `ScreenMarket` hero（无指标行）。顶层包 `InkWell` 让整卡可点；
/// 颜色不读 theme token——hero 是品牌渐变，在 3 套主题下保持视觉锚点一致。
class FeaturedHeroCard extends StatelessWidget {
  const FeaturedHeroCard({
    super.key,
    required this.item,
    required this.onTap,
  });

  final StrategyMarketItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final StrategyCard card = item.card;

    return Padding(
      padding: const EdgeInsets.only(bottom: QzSpacing.md),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(QzRadii.card),
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(QzRadii.card),
              // 三段渐变对齐设计稿 ScreenMarket hero。
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: <Color>[
                  Color(0xFF16122F),
                  Color(0xFF241B52),
                  Color(0xFF14112C),
                ],
                stops: <double>[0.0, 0.52, 1.0],
              ),
            ),
            padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg,
              QzSpacing.md,
              QzSpacing.lg,
              QzSpacing.md,
            ),
            child: Stack(
              children: <Widget>[
                // grid mesh 网格纹理：top-right radial mask（对齐设计稿官网背景）
                Positioned.fill(
                  child: const IgnorePointer(
                    child: CustomPaint(
                      painter: _HeroGridPainter(),
                    ),
                  ),
                ),
                // 右上角向 glow
                const Positioned(
                  top: -46,
                  right: -34,
                  child: _HeroGlow(
                    size: 172,
                    colors: <Color>[
                      Color(0x5C8B67FF),
                      Color(0x1F7C5CFC),
                      Color(0x00000000),
                    ],
                    stops: <double>[0.0, 0.42, 0.72],
                  ),
                ),
                // 左下角反向 glow（增加纵深）
                const Positioned(
                  bottom: -50,
                  left: -40,
                  child: _HeroGlow(
                    size: 150,
                    colors: <Color>[
                      Color(0x1A67E8F9),
                      Color(0x00000000),
                    ],
                    stops: <double>[0.0, 0.70],
                  ),
                ),
                // 装饰 sparkline 半透明铺底
                Positioned.fill(
                  child: Opacity(
                    opacity: 0.35,
                    child: SparklineView(
                      data: item.sparkline,
                      height: 80,
                      strokeWidth: 1.2,
                    ),
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: QzSpacing.sm,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.18),
                            borderRadius:
                                BorderRadius.circular(QzRadii.input),
                          ),
                          // badge 前缀 ★ 对齐设计稿。
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: <Widget>[
                              const Text(
                                '★',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  height: 1.0,
                                ),
                              ),
                              const SizedBox(width: 5),
                              Text(
                                l10n.strategyHomeFeaturedBadge,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.6,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: QzSpacing.sm),
                    // 标题/副标题 + 查看详情胶囊（对齐设计稿，无指标行）。
                    Row(
                      children: <Widget>[
                        QzAvatar(
                          label: card.symbol,
                          size: 36,
                          monospace: true,
                        ),
                        const SizedBox(width: QzSpacing.sm),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Text(
                                card.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: QzSpacing.xxs),
                              Text(
                                '${card.author} · '
                                '${l10n.strategyHomeFeaturedSubtitle}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.82),
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w500,
                                  height: 1.4,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: QzSpacing.sm),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 13,
                            vertical: 7,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.18),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: <Widget>[
                              Text(
                                l10n.strategyHomeFeaturedView,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(width: 5),
                              const Icon(
                                Icons.arrow_forward,
                                color: Colors.white,
                                size: 13,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// 角向 radial glow 装饰圆。
class _HeroGlow extends StatelessWidget {
  const _HeroGlow({
    required this.size,
    required this.colors,
    required this.stops,
  });

  final double size;
  final List<Color> colors;
  final List<double> stops;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(colors: colors, stops: stops),
        ),
      ),
    );
  }
}

/// grid mesh 网格纹理：22px 网格 + top-right radial 渐隐遮罩，
/// 对齐设计稿官网背景签名。
class _HeroGridPainter extends CustomPainter {
  const _HeroGridPainter();

  static const double _cell = 22;
  static const Color _line = Color(0x21A78BFA); // rgba(167,139,250,0.13)

  @override
  void paint(Canvas canvas, Size size) {
    // top-right 圆形渐隐遮罩，让网格只在右上角可见。
    final Offset center = Offset(size.width * 0.82, size.height * 0.08);
    final double radius = size.width * 0.4;
    canvas.saveLayer(Offset.zero & size, Paint());
    canvas.drawRect(
      Offset.zero & size,
      Paint()
        ..shader = RadialGradient(
          colors: const <Color>[Colors.white, Colors.transparent],
          stops: const <double>[0.0, 0.72],
        ).createShader(Rect.fromCircle(center: center, radius: radius)),
    );

    final Paint linePaint = Paint()
      ..color = _line
      ..strokeWidth = 1
      ..blendMode = BlendMode.srcIn;
    for (double x = 0; x <= size.width; x += _cell) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), linePaint);
    }
    for (double y = 0; y <= size.height; y += _cell) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), linePaint);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_HeroGridPainter oldDelegate) => false;
}
