import 'package:flutter/material.dart';

/// 「策略载入对话」toast（#1596 / #1666）：深色半透明胶囊 + 绿色 check + 文案。
///
/// 同时在策略列表（StrategyHomePage）与详情（StrategyDetailPage）的
/// 「载入对话」交互中复用，保证两处视觉/语义一致；对应设计稿
/// `m-screens-2.jsx` 中的 `fireToast` 调用。
class LoadConversationToast extends StatelessWidget {
  const LoadConversationToast({super.key, required this.text});

  /// toast 内容（如「策略 X 已载入对话」）。
  final String text;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 320),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xEB0F0B22),
          borderRadius: BorderRadius.circular(10),
          boxShadow: const <BoxShadow>[
            BoxShadow(
              color: Color(0x520F0B22),
              blurRadius: 24,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const Icon(
              Icons.check_circle,
              color: Color(0xFF16C783),
              size: 16,
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                text,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
