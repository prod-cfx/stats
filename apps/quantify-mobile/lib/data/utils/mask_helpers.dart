/// 通用脱敏 helper。
///
/// 所有函数都是纯函数，无 Flutter / IO 依赖，便于 unit test 直接断言。
library;

/// 把交易所 API key/secret 脱敏为「前 4 + 4 颗星 + 后 4」格式。
///
/// 行为：
/// - 长度 ≥ 8 → `${first4}****${last4}`
/// - 长度 < 8 但非空 → `****`
/// - 空字符串 → 空字符串（让调用方决定是否兜底为「未设置」文案）
///
/// 故意不引入正则或额外校验：mask 是展示层操作，原值合法性由调用方保证。
String maskApiKey(String raw) {
  if (raw.isEmpty) return '';
  if (raw.length < 8) return '****';
  final String first = raw.substring(0, 4);
  final String last = raw.substring(raw.length - 4);
  return '$first****$last';
}

/// 把邮箱本地部分（@ 前）脱敏为「前 2 + 三颗星」。
///
/// 行为：
/// - `victor@gmail.com` → `vi***@gmail.com`
/// - 不含 `@` → 当作本地部分整体处理：`abc` → `ab***`
/// - 本地部分长度 ≤ 2 → 直接 `***@domain`（保留 domain 让用户可识别）
String maskEmail(String email) {
  if (email.isEmpty) return '';
  final int at = email.indexOf('@');
  if (at < 0) {
    if (email.length <= 2) return '***';
    return '${email.substring(0, 2)}***';
  }
  final String local = email.substring(0, at);
  final String domain = email.substring(at);
  if (local.length <= 2) return '***$domain';
  return '${local.substring(0, 2)}***$domain';
}
