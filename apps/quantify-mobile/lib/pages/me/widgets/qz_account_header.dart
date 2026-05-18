import 'package:flutter/material.dart';

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

  static const LinearGradient _gradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: <Color>[Color(0xFF1F0F4A), Color(0xFF2E1A6B)],
  );

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(gradient: _gradient),
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 56),
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
              // 复制按钮：当前迭代仅渲染，onTap 留给后续 Issue 接入剪贴板 + toast。
              IconButton(
                onPressed: null,
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
              if (telegramBound) _HeaderChip(label: AppLocalizations.of(context).meHeaderTelegramBound),
              if (binanceConnected) _HeaderChip(label: AppLocalizations.of(context).meHeaderBinanceConnected),
            ],
          ),
        ],
      ),
    );
  }
}

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
      child: const Icon(Icons.person_outline, color: Colors.white, size: 30),
    );
  }
}

class _HeaderChip extends StatelessWidget {
  const _HeaderChip({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
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
      child: Text(
        label,
        style: const TextStyle(
          color: Color(0xFFDDD6FE),
          fontSize: 11,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}
