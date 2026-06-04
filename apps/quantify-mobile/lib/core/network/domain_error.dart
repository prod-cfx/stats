/// 移动端统一错误分类。后端 `DomainException` 的字符串 `code` 在
/// [DomainError.serverCode] 中保留原值；本枚举只做粗分类供 UI 决策
/// （重试 / 跳登录 / 弹窗）。
///
/// 注：quantify-mobile 当前数据层为 mock，不直接抛 `DioException`，因此本文件
/// 不提供 `fromDio` 工厂；真实网络层接入后再扩展构造路径，`code`/`category`/
/// `canRetry` 字段语义保持稳定。
enum DomainErrorCode {
  /// 无网络 / 连接错误（无 HTTP 响应）。
  network,

  /// 连接 / 发送 / 接收超时。
  timeout,

  /// 请求被取消。UI 层应静默忽略，避免 setState after dispose。
  cancelled,

  /// HTTP 401。应触发清会话并跳登录。
  unauthorized,

  /// HTTP 403。
  forbidden,

  /// HTTP 404。
  notFound,

  /// HTTP 400 / 422（参数校验失败）。
  validation,

  /// HTTP 5xx。
  serverError,

  /// 兜底。
  unknown,
}

/// 错误大类（与 Web `NormalizedError.category` 对齐），用于上报 / 重试策略 /
/// UI 分发的语义层。
enum ErrorCategory {
  /// 无网络 / 超时。
  network,

  /// 认证 / 授权（401/403）。
  auth,

  /// 表单 / 参数校验（400/422）。
  validation,

  /// 后端业务错误（携带 serverCode 的 4xx）。
  business,

  /// 其它 4xx 客户端错误。
  httpClient,

  /// 5xx 服务端错误。
  httpServer,

  /// 兜底。
  unknown,
}

/// 统一异常模型。所有 Repository 应抛出 [DomainError]（或子类），UI 层只识别
/// [DomainError]，由 `ErrorRouter` 归一与决策。
class DomainError implements Exception {
  /// 粗分类。
  final DomainErrorCode code;

  /// 展示文案。
  final String message;

  /// HTTP 状态码（若有）。
  final int? statusCode;

  /// 后端 `DomainException` 的字符串 code，如 `WALLET_INSUFFICIENT_BALANCE`。
  final String? serverCode;

  /// 后端 `DomainException.i18nKey`。
  final String? i18nKey;

  /// 后端 `DomainException.args`，参数化文案的插值参数。
  final Map<String, Object?>? i18nArgs;

  /// 后端 trace id，用于线上排障。
  final String? requestId;

  /// 大类（与 Web `NormalizedError.category` 对齐）。
  final ErrorCategory category;

  /// 是否建议重试：network / timeout / 5xx / 429 → true，其它 → false。
  final bool canRetry;

  /// 原始异常，便于日志 / 排查。
  final Object? cause;

  const DomainError({
    required this.code,
    required this.message,
    this.statusCode,
    this.serverCode,
    this.i18nKey,
    this.i18nArgs,
    this.requestId,
    this.cause,
    this.category = ErrorCategory.unknown,
    this.canRetry = false,
  });

  @override
  String toString() {
    final buf = StringBuffer('DomainError(code=$code')
      ..write(', statusCode=$statusCode')
      ..write(', serverCode=$serverCode')
      ..write(', category=$category')
      ..write(', canRetry=$canRetry');
    if (i18nKey != null) buf.write(', i18nKey=$i18nKey');
    if (requestId != null) buf.write(', requestId=$requestId');
    buf.write(', message=$message)');
    return buf.toString();
  }
}
