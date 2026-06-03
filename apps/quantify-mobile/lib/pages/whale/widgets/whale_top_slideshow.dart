import 'dart:async';

import 'package:flutter/material.dart';

import '../../../data/models/whale_leader_models.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import 'whale_card_controls.dart';

/// 发现 tab top3 轮播（issue #1789 / #1860）。单卡 PageView + 圆点 pager，可滑动
/// 切换，并以 4500ms 间隔自动播放（对齐设计 `WhaleTopSlideshow` autoplay `:179`）。
class WhaleTopSlideshow extends StatefulWidget {
  const WhaleTopSlideshow({
    required this.top3,
    required this.onOpen,
    required this.onStats,
    required this.onCopy,
    super.key,
  });

  final List<WhaleLeaderEntry> top3;

  /// 点地址 → 详情页。
  final void Function(WhaleLeaderEntry) onOpen;

  /// 点卡片 / 趋势按钮 → 交易统计弹窗。
  final void Function(WhaleLeaderEntry) onStats;

  /// 点复制按钮 → 复制地址。
  final void Function(WhaleLeaderEntry) onCopy;

  @override
  State<WhaleTopSlideshow> createState() => _WhaleTopSlideshowState();
}

class _WhaleTopSlideshowState extends State<WhaleTopSlideshow> {
  static const Duration _autoplayInterval = Duration(milliseconds: 4500);

  final PageController _controller = PageController();
  Timer? _autoplay;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    _startAutoplay();
  }

  void _startAutoplay() {
    _autoplay?.cancel();
    if (widget.top3.length < 2) return;
    _autoplay = Timer.periodic(_autoplayInterval, (_) {
      if (!mounted || !_controller.hasClients) return;
      final int next = (_index + 1) % widget.top3.length;
      _controller.animateToPage(
        next,
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  void dispose() {
    _autoplay?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    if (widget.top3.isEmpty) return const SizedBox.shrink();
    return Column(
      children: <Widget>[
        SizedBox(
          height: 164,
          child: PageView.builder(
            controller: _controller,
            itemCount: widget.top3.length,
            onPageChanged: (int i) => setState(() => _index = i),
            itemBuilder: (BuildContext context, int i) {
              final WhaleLeaderEntry e = widget.top3[i];
              return Align(
                alignment: Alignment.topCenter,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: QzSpacing.lg),
                  child: WhaleTopCard(
                    entry: e,
                    onOpen: () => widget.onOpen(e),
                    onStats: () => widget.onStats(e),
                    onCopy: () => widget.onCopy(e),
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: QzSpacing.sm),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            for (int i = 0; i < widget.top3.length; i++)
              GestureDetector(
                onTap: () => _controller.animateToPage(
                  i,
                  duration: const Duration(milliseconds: 220),
                  curve: Curves.easeOut,
                ),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: i == _index ? 18 : 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: i == _index ? c.text : c.borderSoft,
                    borderRadius: BorderRadius.circular(QzRadii.pill),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

/// top3 hero 卡（issue #1789 / #1860）。渐变背景 + 头像徽章 + 地址（复制 / chevron）
/// + tier 两段（圆点 + 金额 + 词）+ 趋势按钮 + 账户总价值 + pnl 药丸 + 三 mini stat。
///
/// 双入口：点地址 → [onOpen]（详情页）；点卡片或趋势按钮 → [onStats]（统计弹窗）。
class WhaleTopCard extends StatelessWidget {
  const WhaleTopCard({
    required this.entry,
    required this.onOpen,
    required this.onStats,
    required this.onCopy,
    super.key,
  });

  final WhaleLeaderEntry entry;
  final VoidCallback onOpen;
  final VoidCallback onStats;
  final VoidCallback onCopy;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color tint = entry.avatarBgHex != null
        ? Color(entry.avatarBgHex!)
        : c.accent;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onStats,
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
          decoration: BoxDecoration(
            // 三段渐变贴近设计 155°：tint 高透(0%) → tint 低透(40%) → elev(78%)
            // （`m-screens-whale-discover.jsx:317`）。155° 自顶偏右下，用
            // topCenter→bottomRight 近似。
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomRight,
              stops: const <double>[0.0, 0.4, 0.78],
              colors: <Color>[
                tint.withValues(alpha: 0.11),
                tint.withValues(alpha: 0.02),
                c.bgElev,
              ],
            ),
            border: Border.all(color: tint.withValues(alpha: 0.2)),
            borderRadius: BorderRadius.circular(14),
            // 底部柔和阴影，对齐设计 `0 6px 16px -12px tint55`（`:323`）。
            boxShadow: <BoxShadow>[
              BoxShadow(
                color: tint.withValues(alpha: 0.33),
                blurRadius: 16,
                spreadRadius: -12,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              _head(c, tint),
              const SizedBox(height: QzSpacing.sm),
              _aumRow(c),
              const SizedBox(height: QzSpacing.sm),
              _miniStats(c),
            ],
          ),
        ),
      ),
    );
  }

  Widget _head(QzColorScheme c, Color tint) {
    return Row(
      children: <Widget>[
        Container(
          width: 32,
          height: 32,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: tint, shape: BoxShape.circle),
          child: Text(
            entry.avatarText ?? '',
            style: TextStyle(
              color: entry.avatarTextHex != null
                  ? Color(entry.avatarTextHex!)
                  : Colors.white,
              fontSize: 13,
              fontWeight: FontWeight.w700,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
          ),
        ),
        const SizedBox(width: QzSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Flexible(
                    child: WhaleAddressLink(
                      address: entry.id,
                      onOpen: onOpen,
                      fontSize: 13,
                    ),
                  ),
                  WhaleCopyButton(onCopy: onCopy),
                ],
              ),
              if (entry.tier != null) ...<Widget>[
                const SizedBox(height: 2),
                _tierRow(c, tint),
              ],
            ],
          ),
        ),
        const SizedBox(width: QzSpacing.xs),
        WhaleTrendButton(onStats: onStats),
      ],
    );
  }

  /// tier 两段渲染：圆点 + 金额（tierAmt）+ 词（tierWord），对齐设计 `:347`。
  Widget _tierRow(QzColorScheme c, Color tint) {
    final RegExpMatch? m = RegExp(
      r'^(\$[\d.]+[A-Z]?\+?)\s+(.+)$',
    ).firstMatch(entry.tier!);
    final String tierAmt = m != null ? m.group(1)! : entry.tier!;
    final String tierWord = m != null ? m.group(2)! : '';
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Container(
          width: 4,
          height: 4,
          decoration: BoxDecoration(color: tint, shape: BoxShape.circle),
        ),
        const SizedBox(width: 5),
        Text(
          tierAmt,
          style: TextStyle(
            color: tint,
            fontSize: 9,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.4,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
        if (tierWord.isNotEmpty) ...<Widget>[
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              tierWord,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: c.textMid,
                fontSize: 8.5,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.6,
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _aumRow(QzColorScheme c) {
    final Color pnlColor = entry.pnlPositive ? c.marketUp : c.marketDown;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: <Widget>[
            Text('账户总价值', style: TextStyle(color: c.textDim, fontSize: 10)),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                color: pnlColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                entry.pnlDisplay,
                style: TextStyle(
                  color: pnlColor,
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 1),
        Text(
          entry.aumDisplay,
          style: TextStyle(
            color: c.text,
            fontSize: 17,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.4,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      ],
    );
  }

  Widget _miniStats(QzColorScheme c) {
    return Row(
      children: <Widget>[
        _MiniStat(
          label: '交易',
          value: '${entry.trades}',
          align: CrossAxisAlignment.start,
        ),
        _MiniStat(
          label: '胜率',
          value: '${entry.winRate.toStringAsFixed(2)}%',
          highlight: entry.winRate >= 60,
        ),
        _MiniStat(
          label: '持仓',
          value: '${entry.positions}',
          align: CrossAxisAlignment.end,
        ),
      ],
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({
    required this.label,
    required this.value,
    this.highlight = false,
    this.align = CrossAxisAlignment.center,
  });

  final String label;
  final String value;
  final bool highlight;

  /// 内部文字对齐，对齐设计 `MiniStatTop` 的 `textAlign`：交易左 / 胜率中 / 持仓右。
  final CrossAxisAlignment align;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Expanded(
      child: Column(
        crossAxisAlignment: align,
        children: <Widget>[
          Text(
            label,
            textAlign: _textAlign,
            style: TextStyle(color: c.textDim, fontSize: 9),
          ),
          const SizedBox(height: 1),
          Text(
            value,
            textAlign: _textAlign,
            style: TextStyle(
              color: highlight ? c.marketUp : c.text,
              fontSize: 12,
              fontWeight: FontWeight.w700,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
          ),
        ],
      ),
    );
  }

  TextAlign get _textAlign => switch (align) {
    CrossAxisAlignment.start => TextAlign.left,
    CrossAxisAlignment.end => TextAlign.right,
    _ => TextAlign.center,
  };
}
