import '../../models/account_models.dart';

/// 原型第 9 屏「我的」页面的展示数据。
///
/// email/uid 直接来自 `design/project/mobile/m-screens-4.jsx:971-973`。
const AccountInfo mockAccountInfo = AccountInfo(
  userId: 'mock-user',
  email: 'victor@gmail.com',
  uid: 'cmp42glf60001yxqs0ivc09ff',
  totalEquityUsd: 12_345.67,
  availableBalanceUsd: 8_210.50,
  unrealizedPnlUsd: 312.18,
);
