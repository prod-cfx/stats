import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/api_key_models.dart';
import '../../data/providers.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_spinner.dart';
import 'api_form_sheet.dart';

/// 固定交易所槽位顺序，与原型一致。
const List<String> _exchanges = <String>['Binance', 'OKX', 'Hyperliquid'];

/// `/me/api` 交易所凭据列表页（原型 `m-screens-4.jsx:1013-1018` 的扩展）。
///
/// 三个固定交易所槽位：
/// - 已配置 → 显示「已连接 · 读取 + 下单」+ maskedKey + 「管理」按钮
/// - 未配置 → 显示「未配置」+ 「连接」按钮
///
/// 数据来源：`apiKeysProvider`（与 `/me` 首页共享同一份）。表单保存成功后
/// `ref.invalidate(apiKeysProvider)` 让两处同步刷新，避免出现「`/me/api`
/// 新增凭据后回到 `/me` 摘要不更新」的数据不一致问题。
class ApiSettingsPage extends ConsumerWidget {
  const ApiSettingsPage({super.key});

  Future<void> _openSheet(
    BuildContext context,
    WidgetRef ref,
    String exchange,
  ) async {
    final bool? saved =
        await showApiFormSheet(context, exchange: exchange);
    if (saved == true) {
      // 让 `apiKeysProvider` 失效 → `/me` 摘要与本页同步刷新。
      ref.invalidate(apiKeysProvider);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final QzColorScheme c = context.qzScheme;
    final AsyncValue<List<ExchangeApiKey>> keys = ref.watch(apiKeysProvider);

    return Scaffold(
      backgroundColor: c.bg,
      appBar: AppBar(
        backgroundColor: c.bgElev,
        foregroundColor: c.text,
        elevation: 0,
        title: const Text('交易所 API'),
      ),
      body: keys.when(
        loading: () => const Center(child: QzSpinner()),
        error: (Object e, StackTrace st) => Center(
          child: Text(
            '加载失败：$e',
            style: TextStyle(color: c.statusDanger),
          ),
        ),
        data: (List<ExchangeApiKey> list) {
          ExchangeApiKey? findKey(String ex) {
            for (final ExchangeApiKey k in list) {
              if (k.exchange.toLowerCase() == ex.toLowerCase()) return k;
            }
            return null;
          }

          return ListView(
            padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg,
              QzSpacing.xl,
              QzSpacing.lg,
              QzSpacing.xxl,
            ),
            children: <Widget>[
              for (final String ex in _exchanges)
                _ExchangeRow(
                  exchange: ex,
                  existingKey: findKey(ex),
                  onTap: () => _openSheet(context, ref, ex),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _ExchangeRow extends StatelessWidget {
  const _ExchangeRow({
    required this.exchange,
    required this.existingKey,
    required this.onTap,
  });

  final String exchange;
  final ExchangeApiKey? existingKey;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final ExchangeApiKey? k = existingKey;
    final bool configured = k != null;

    return Container(
      margin: const EdgeInsets.only(bottom: QzSpacing.md),
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.lg,
        vertical: 14,
      ),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      child: Row(
        children: <Widget>[
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: c.bgSoft,
              borderRadius: BorderRadius.circular(10),
            ),
            alignment: Alignment.center,
            child: Text(
              exchange.substring(0, 1),
              style: TextStyle(
                color: c.text,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: QzSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(
                  exchange,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 3),
                if (configured) ...<Widget>[
                  Text(
                    '已连接 · 读取 + 下单',
                    style: TextStyle(color: c.statusOk, fontSize: 11),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    k.maskedKey,
                    style: TextStyle(
                      color: c.textDim,
                      fontSize: 11,
                      fontFamilyFallback: const <String>[
                        'ui-monospace',
                        'monospace',
                      ],
                    ),
                  ),
                ] else
                  Text(
                    '未配置 · 部署策略前请配置',
                    style: TextStyle(color: c.statusWarn, fontSize: 11),
                  ),
              ],
            ),
          ),
          SizedBox(
            height: 30,
            child: TextButton(
              onPressed: onTap,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                backgroundColor:
                    configured ? c.bgSoft : c.accent.withValues(alpha: 0.16),
                foregroundColor: configured ? c.textMid : c.accent,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                textStyle: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              child: Text(configured ? '管理' : '连接'),
            ),
          ),
        ],
      ),
    );
  }
}
