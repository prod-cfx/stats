import 'package:flutter/material.dart';

import '../../../data/models/strategy_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/tokens.dart';
import 'sparkline_view.dart';

/// 「本周推荐」featured hero 卡（#1565）。
///
/// 紫色渐变背景 + 半透明 sparkline 装饰 + 3 项核心指标（CAGR / Sharpe / 回撤）。
/// 顶层包 `InkWell` 让整卡可点；颜色不读 theme token——hero 是品牌渐变，
/// 在 3 套主题下保持视觉锚点一致。
class FeaturedHeroCard extends StatelessWidget {
  const FeaturedHeroCard({
    super.key,
    required this.item,
    required this.onTap,
  });

  final StrategyMarketItem item;
  final VoidCallback onTap;

  String _fmtPct(double v, {bool sign = true}) =>
      '${sign && v > 0 ? '+' : ''}${v.toStringAsFixed(1)}%';

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final StrategyCard card = item.card;
    final StrategyMarketStats stats = item.stats;

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
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: <Color>[
                  Color(0xFF1A1530),
                  Color(0xFF2B1E5A),
                ],
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
                          child: Text(
                            l10n.strategyHomeFeaturedBadge,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.6,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: QzSpacing.sm),
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
                      '${card.author} · ${l10n.strategyHomeFeaturedSubtitle}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.82),
                        fontSize: 11.5,
                        fontWeight: FontWeight.w500,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: QzSpacing.sm),
                    Row(
                      children: <Widget>[
                        _HeroStat(
                          label: l10n.strategyHomeStatCagr,
                          value: _fmtPct(stats.cagr),
                          hot: true,
                        ),
                        const SizedBox(width: QzSpacing.lg),
                        _HeroStat(
                          label: l10n.strategyHomeStatSharpe,
                          value: stats.sharpe.toStringAsFixed(2),
                        ),
                        const SizedBox(width: QzSpacing.lg),
                        _HeroStat(
                          label: l10n.strategyHomeStatDrawdown,
                          value: _fmtPct(stats.maxDrawdown, sign: false),
                        ),
                        const Spacer(),
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

class _HeroStat extends StatelessWidget {
  const _HeroStat({
    required this.label,
    required this.value,
    this.hot = false,
  });

  final String label;
  final String value;
  final bool hot;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.6),
            fontSize: 9,
            letterSpacing: 0.4,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            color: hot ? const Color(0xFF7EFFB0) : Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.w700,
            fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
          ),
        ),
      ],
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
