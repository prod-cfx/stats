import 'package:flutter/material.dart';

import '../../../data/models/pred_market_models.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../widgets/qz_pulse_dot.dart';

/// 预测市场卡片（设计稿 `PredCard`:1530）。
///
/// icon 方块 + 问题（3 行截断）+ 是/否%（yes 为 null 时不渲染）+ 底栏
/// LIVE 静态点 + Vol + 更多按钮。点击整卡触发 [onTap]（打开详情）。
class PredMarketCard extends StatelessWidget {
  const PredMarketCard({super.key, required this.market, required this.onTap});

  final PredMarket market;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final int? yes = market.yesPercent;
    final String volText = fmtPredVol(market.volume) ?? '\$0 Vol.';
    return GestureDetector(
      key: Key('pred-card-${market.id}'),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
        decoration: BoxDecoration(
          color: c.bgElev,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: c.borderSoft),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                _iconBadge(22, 12),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    market.question,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: c.text,
                      fontSize: 11.5,
                      height: 1.4,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                _iconButton(
                  key: Key('pred-card-info-${market.id}'),
                  icon: Icons.info_outline,
                  size: 13,
                  tooltip: '信息',
                  color: c.textDim,
                ),
              ],
            ),
            if (yes != null) ...<Widget>[
              const SizedBox(height: 8),
              _pctRow('是', '$yes%', c.marketUp, c),
              const SizedBox(height: 2),
              _pctRow('否', '${market.noPercent}%', c.marketDown, c),
            ],
            const SizedBox(height: 8),
            Row(
              children: <Widget>[
                if (market.live) ...<Widget>[
                  _liveDot(c),
                  const SizedBox(width: 6),
                ],
                Expanded(
                  child: Text(
                    volText,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: c.textDim, fontSize: 10),
                  ),
                ),
                _iconButton(
                  key: Key('pred-card-more-${market.id}'),
                  icon: Icons.more_horiz,
                  size: 14,
                  tooltip: '更多',
                  color: c.textDim,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _iconBadge(double box, double icon) {
    return Container(
      width: box,
      height: box,
      decoration: BoxDecoration(
        color: market.color,
        borderRadius: BorderRadius.circular(6),
      ),
      alignment: Alignment.center,
      child: Icon(predIconData(market.icon), size: icon, color: Colors.white),
    );
  }

  Widget _pctRow(
    String label,
    String value,
    Color valueColor,
    QzColorScheme c,
  ) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: <Widget>[
        Text(label, style: TextStyle(color: c.textMid, fontSize: 11)),
        Text(
          value,
          style: TextStyle(
            color: valueColor,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  Widget _liveDot(QzColorScheme c) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        QzPulseDot(color: c.marketDown, size: 6, ringSpread: 6),
        const SizedBox(width: 1),
        Text(
          'LIVE',
          style: TextStyle(
            color: c.marketDown,
            fontSize: 10,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  /// 信息 / 更多按钮：对齐设计稿仅 stopPropagation（吞掉点击，不冒泡到整卡
  /// `onTap`），暂无独立动作。
  Widget _iconButton({
    required Key key,
    required IconData icon,
    required double size,
    required String tooltip,
    required Color color,
  }) {
    return Semantics(
      button: true,
      label: tooltip,
      child: GestureDetector(
        key: key,
        behavior: HitTestBehavior.opaque,
        onTap: () {}, // 吞掉点击，阻止冒泡到整卡 onTap
        child: Icon(icon, size: size, color: color),
      ),
    );
  }
}
