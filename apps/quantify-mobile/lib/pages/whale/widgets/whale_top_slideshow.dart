import 'package:flutter/material.dart';

import '../../../data/models/whale_leader_models.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 发现 tab top3 轮播（issue #1789）。单卡 PageView + 圆点 pager，可滑动切换。
class WhaleTopSlideshow extends StatefulWidget {
  const WhaleTopSlideshow({
    required this.top3,
    required this.onTap,
    super.key,
  });

  final List<WhaleLeaderEntry> top3;
  final void Function(WhaleLeaderEntry) onTap;

  @override
  State<WhaleTopSlideshow> createState() => _WhaleTopSlideshowState();
}

class _WhaleTopSlideshowState extends State<WhaleTopSlideshow> {
  final PageController _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
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
          height: 156,
          child: PageView.builder(
            controller: _controller,
            itemCount: widget.top3.length,
            onPageChanged: (int i) => setState(() => _index = i),
            itemBuilder: (BuildContext context, int i) {
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: QzSpacing.lg),
                child: WhaleTopCard(
                  entry: widget.top3[i],
                  onTap: () => widget.onTap(widget.top3[i]),
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

/// top3 hero 卡。渐变背景 + 头像徽章 + 账户总价值 + pnl 药丸 + 三 mini stat。
class WhaleTopCard extends StatelessWidget {
  const WhaleTopCard({required this.entry, required this.onTap, super.key});

  final WhaleLeaderEntry entry;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color tint =
        entry.avatarBgHex != null ? Color(entry.avatarBgHex!) : c.accent;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: <Color>[
                tint.withValues(alpha: 0.11),
                c.bgElev,
              ],
            ),
            border: Border.all(color: tint.withValues(alpha: 0.2)),
            borderRadius: BorderRadius.circular(14),
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
            ),
          ),
        ),
        const SizedBox(width: QzSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                entry.id,
                style: TextStyle(
                  color: c.accent,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (entry.tier != null) ...<Widget>[
                const SizedBox(height: 2),
                Text(
                  entry.tier!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: tint,
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.3,
                  ),
                ),
              ],
            ],
          ),
        ),
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
            Text(
              '账户总价值',
              style: TextStyle(color: c.textDim, fontSize: 10),
            ),
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
          ),
        ),
      ],
    );
  }

  Widget _miniStats(QzColorScheme c) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: <Widget>[
        _MiniStat(label: '交易', value: '${entry.trades}'),
        _MiniStat(
          label: '胜率',
          value: '${entry.winRate.toStringAsFixed(2)}%',
          highlight: entry.winRate >= 60,
        ),
        _MiniStat(label: '持仓', value: '${entry.positions}'),
      ],
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({
    required this.label,
    required this.value,
    this.highlight = false,
  });

  final String label;
  final String value;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      children: <Widget>[
        Text(label, style: TextStyle(color: c.textDim, fontSize: 9)),
        const SizedBox(height: 1),
        Text(
          value,
          style: TextStyle(
            color: highlight ? c.marketUp : c.text,
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}
