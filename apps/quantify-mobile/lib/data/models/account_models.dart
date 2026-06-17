/// 账户概要。
///
/// - [userId] 业务唯一 ID（内部），通常不直接展示
/// - [email] 用户邮箱（`/me` 页面脱敏渲染为 `vi***@gmail.com`）
/// - [uid] 对外用户编号（mono 字体 + 复制按钮，对齐原型第 9 屏）
class AccountInfo {
  final String userId;
  final String email;
  final String uid;
  final AccountTelegramBinding? telegram;
  final double totalEquityUsd;
  final double availableBalanceUsd;
  final double unrealizedPnlUsd;

  const AccountInfo({
    required this.userId,
    required this.email,
    required this.uid,
    this.telegram,
    required this.totalEquityUsd,
    required this.availableBalanceUsd,
    required this.unrealizedPnlUsd,
  });
}

class AccountTelegramBinding {
  final String id;
  final String? username;
  final bool isLinked;

  const AccountTelegramBinding({
    required this.id,
    required this.username,
    required this.isLinked,
  });

  String get displayName {
    final String? name = username?.trim();
    if (name != null && name.isNotEmpty) return '@$name';
    return 'ID $id';
  }
}
