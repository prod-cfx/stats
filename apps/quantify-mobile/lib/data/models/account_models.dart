/// 账户概要。
class AccountInfo {
  final String userId;
  final double totalEquityUsd;
  final double availableBalanceUsd;
  final double unrealizedPnlUsd;

  const AccountInfo({
    required this.userId,
    required this.totalEquityUsd,
    required this.availableBalanceUsd,
    required this.unrealizedPnlUsd,
  });
}
