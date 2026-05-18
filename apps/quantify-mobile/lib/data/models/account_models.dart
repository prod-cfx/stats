/// 账户概要。
///
/// - [userId] 业务唯一 ID（内部），通常不直接展示
/// - [email] 用户邮箱（`/me` 页面脱敏渲染为 `vi***@gmail.com`）
/// - [uid] 对外用户编号（mono 字体 + 复制按钮，对齐原型第 9 屏）
class AccountInfo {
  final String userId;
  final String email;
  final String uid;
  final double totalEquityUsd;
  final double availableBalanceUsd;
  final double unrealizedPnlUsd;

  const AccountInfo({
    required this.userId,
    required this.email,
    required this.uid,
    required this.totalEquityUsd,
    required this.availableBalanceUsd,
    required this.unrealizedPnlUsd,
  });
}
