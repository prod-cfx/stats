/// Data Service 层 barrel（issue #2189）。
///
/// Service 一律 stateless：构造注入 [ApiClient]，方法返回解码后的 JSON
/// （`Map`/`List`），不持有可变状态、不做领域模型转换（转换在 Repository）。
library;

export 'account_services.dart';
export 'api_client.dart';
export 'auth_service.dart';
export 'json_codec.dart';
export 'market_services.dart';
export 'strategy_services.dart';
export 'whale_services.dart';
