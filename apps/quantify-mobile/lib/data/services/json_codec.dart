/// 防御式 JSON 取值助手（issue #2189）。
///
/// 后端契约未定稿，响应字段可能缺失/类型漂移。Repository 反序列化时统一用
/// 这组纯函数取值，缺字段回退默认值而非抛错，保证 UI 不因单条脏数据崩溃。
library;

/// 把任意 JSON 值规约为 `Map<String, dynamic>`；非 map 返回空 map。
Map<String, dynamic> asMap(Object? raw) {
  if (raw is Map<String, dynamic>) return raw;
  if (raw is Map) {
    return raw.map((Object? k, Object? v) => MapEntry<String, dynamic>('$k', v));
  }
  return <String, dynamic>{};
}

/// 把任意 JSON 值规约为 `List`；非 list 返回空 list。
List<dynamic> asList(Object? raw) {
  if (raw is List) return raw;
  return const <dynamic>[];
}

/// 把 list 中每个元素当 map 解析。
List<Map<String, dynamic>> asMapList(Object? raw) {
  return asList(raw).map(asMap).toList(growable: false);
}

double asDouble(Object? raw, {double fallback = 0}) {
  if (raw is num) return raw.toDouble();
  if (raw is String) return double.tryParse(raw) ?? fallback;
  return fallback;
}

double? asDoubleOrNull(Object? raw) {
  if (raw is num) return raw.toDouble();
  if (raw is String) return double.tryParse(raw);
  return null;
}

int asInt(Object? raw, {int fallback = 0}) {
  if (raw is int) return raw;
  if (raw is num) return raw.toInt();
  if (raw is String) return int.tryParse(raw) ?? fallback;
  return fallback;
}

int? asIntOrNull(Object? raw) {
  if (raw is int) return raw;
  if (raw is num) return raw.toInt();
  if (raw is String) return int.tryParse(raw);
  return null;
}

String asString(Object? raw, {String fallback = ''}) {
  if (raw is String) return raw;
  if (raw == null) return fallback;
  return raw.toString();
}

String? asStringOrNull(Object? raw) {
  if (raw is String) return raw;
  if (raw == null) return null;
  return raw.toString();
}

bool asBool(Object? raw, {bool fallback = false}) {
  if (raw is bool) return raw;
  if (raw is num) return raw != 0;
  if (raw is String) {
    final String s = raw.toLowerCase();
    if (s == 'true' || s == '1') return true;
    if (s == 'false' || s == '0') return false;
  }
  return fallback;
}

/// 解析 ISO8601 字符串或 epoch 毫秒数为 [DateTime]；失败回退 [fallback]
/// （默认当前时间）。
DateTime asDateTime(Object? raw, {DateTime? fallback}) {
  if (raw is String) {
    final DateTime? parsed = DateTime.tryParse(raw);
    if (parsed != null) return parsed;
  }
  if (raw is num) {
    return DateTime.fromMillisecondsSinceEpoch(raw.toInt());
  }
  return fallback ?? DateTime.now();
}

/// 取首个非空字段：按 [keys] 顺序返回第一个存在的值。
Object? pick(Map<String, dynamic> map, List<String> keys) {
  for (final String k in keys) {
    final Object? v = map[k];
    if (v != null) return v;
  }
  return null;
}
