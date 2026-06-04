import 'package:flutter/material.dart';

import '../../../data/mock/fixtures/agg_orders.dart';
import '../../../data/models/agg_orders_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import 'agg_coin_chips.dart';
import 'agg_exchange_avatar.dart';
import 'agg_format.dart';

/// 聚合持仓量 tab（设计稿 `OpenInterestTab`:1245）。
///
/// 币种 chips + 交易所表（占比条 / 持仓 USD+量 / 24H 变化 badge / 全部行）。
///
/// 排序入口已按设计稿对齐移除（Issue #1919，decisions.md 同日节）：设计稿
/// `OpenInterestTab` 渲染层只有 chips + 表格，排序 state 在设计稿中即为未渲染
/// 死代码；表格按 fixtures 原始顺序展示，不再提供排序按钮 / 抽屉。
class AggOpenInterestTab extends StatefulWidget {
  const AggOpenInterestTab({super.key});

  @override
  State<AggOpenInterestTab> createState() => _AggOpenInterestTabState();
}

class _AggOpenInterestTabState extends State<AggOpenInterestTab> {
  String _coin = 'BTC';

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final OiSnapshot? data = kOiData[_coin];
    final List<OiRow> rows = data?.rows ?? <OiRow>[];
    final double maxPct = rows.isEmpty
        ? 1
        : rows
              .map((OiRow r) => r.pct)
              .reduce((double a, double b) => a > b ? a : b);

    return ListView(
      key: const Key('agg-oi-list'),
      padding: const EdgeInsets.only(top: QzSpacing.md, bottom: 100),
      children: <Widget>[
        AggCoinChips(
          coins: kOiCoins,
          value: _coin,
          onChanged: (String v) => setState(() => _coin = v),
        ),
        const SizedBox(height: QzSpacing.sm),
        if (data == null)
          _emptyCoin(c, l10n)
        else
          Container(
            margin: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
            decoration: BoxDecoration(
              color: c.bgElev,
              borderRadius: BorderRadius.circular(QzRadii.card),
              border: Border.all(color: c.borderSoft),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: <Widget>[
                _Header(),
                _TotalRow(coin: _coin, total: data.total),
                for (final OiRow r in rows)
                  _Row(coin: _coin, row: r, maxPct: maxPct),
              ],
            ),
          ),
      ],
    );
  }

  Widget _emptyCoin(QzColorScheme c, AppLocalizations l10n) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Column(
        children: <Widget>[
          Text(_coin, style: TextStyle(color: c.textDim, fontSize: 13)),
          const SizedBox(height: QzSpacing.xs),
          Text(
            l10n.aggNoData,
            style: TextStyle(color: c.textFaint, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

const List<int> _oiFlex = <int>[40, 22, 30, 26];

class _Header extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    TextStyle s() => TextStyle(
      color: c.textDim,
      fontSize: 11,
      fontFamily: QzFont.mono,
      fontFamilyFallback: QzFont.monoFallback,
    );
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.sm,
        QzSpacing.lg,
        QzSpacing.xs,
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            flex: _oiFlex[0],
            child: Text(l10n.aggOiColExchange, style: s()),
          ),
          Expanded(
            flex: _oiFlex[1],
            child: Text(l10n.aggOiColShare, style: s()),
          ),
          Expanded(
            flex: _oiFlex[2],
            child: Text(
              l10n.aggOiColPosition,
              textAlign: TextAlign.right,
              style: s(),
            ),
          ),
          Expanded(
            flex: _oiFlex[3],
            child: Text(
              l10n.aggOiCol24hChange,
              textAlign: TextAlign.right,
              style: s(),
            ),
          ),
        ],
      ),
    );
  }
}

class _ShareBar extends StatelessWidget {
  const _ShareBar({required this.label, required this.fraction});

  final String label;
  final double fraction;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: TextStyle(
            color: c.text,
            fontSize: 12,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
        const SizedBox(height: 3),
        ClipRRect(
          borderRadius: BorderRadius.circular(2),
          child: Stack(
            children: <Widget>[
              Container(height: 3, color: c.bgSoft),
              FractionallySizedBox(
                widthFactor: fraction.clamp(0, 1),
                child: Container(height: 3, color: c.accent),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ChangeBadge extends StatelessWidget {
  const _ChangeBadge({required this.value});

  final double value;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final bool pos = value >= 0;
    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
        decoration: BoxDecoration(
          color: pos ? c.marketUp : c.marketDown,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          '${pos ? '+' : ''}${value.toStringAsFixed(2)}%',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _Position extends StatelessWidget {
  const _Position({required this.usd, required this.qtyLabel});

  final double usd;
  final String qtyLabel;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: <Widget>[
        Text(
          fmtOiUsd(usd),
          style: TextStyle(
            color: c.text,
            fontSize: 12,
            fontWeight: FontWeight.w600,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
        const SizedBox(height: 1),
        Text(
          qtyLabel,
          style: TextStyle(
            color: c.textDim,
            fontSize: 10.5,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      ],
    );
  }
}

class _TotalRow extends StatelessWidget {
  const _TotalRow({required this.coin, required this.total});

  final String coin;
  final OiTotal total;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.lg,
        vertical: QzSpacing.sm + 2,
      ),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: <Widget>[
          Expanded(
            flex: _oiFlex[0],
            child: Row(
              children: <Widget>[
                Container(
                  width: 28,
                  height: 28,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: c.bgSoft,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: c.borderSoft),
                  ),
                  child: Text(
                    '#',
                    style: TextStyle(
                      color: c.textMid,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: QzSpacing.sm),
                Flexible(
                  child: Text(
                    l10n.aggOiRowAll,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: c.text,
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            flex: _oiFlex[1],
            child: const _ShareBar(label: '100%', fraction: 1),
          ),
          Expanded(
            flex: _oiFlex[2],
            child: _Position(
              usd: total.usd,
              qtyLabel: fmtOiQty(total.qty, coin),
            ),
          ),
          Expanded(
            flex: _oiFlex[3],
            child: _ChangeBadge(value: total.h24),
          ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.coin, required this.row, required this.maxPct});

  final String coin;
  final OiRow row;
  final double maxPct;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AggExchange? ex = kOiExchangeMap[row.exchange];
    return Container(
      key: Key('agg-oi-row-${row.exchange}'),
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.lg,
        vertical: QzSpacing.sm + 2,
      ),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: <Widget>[
          Expanded(
            flex: _oiFlex[0],
            child: Row(
              children: <Widget>[
                if (ex != null) AggExchangeAvatar(exchange: ex, size: 28),
                const SizedBox(width: QzSpacing.sm),
                Flexible(
                  child: Text(
                    ex?.name ?? row.exchange,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: c.text,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            flex: _oiFlex[1],
            child: _ShareBar(
              label: '${row.pct.toStringAsFixed(1)}%',
              fraction: maxPct <= 0 ? 0 : row.pct / maxPct,
            ),
          ),
          Expanded(
            flex: _oiFlex[2],
            child: _Position(usd: row.usd, qtyLabel: fmtOiQty(row.qty, coin)),
          ),
          Expanded(
            flex: _oiFlex[3],
            child: _ChangeBadge(value: row.h24),
          ),
        ],
      ),
    );
  }
}
