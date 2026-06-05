import 'package:backend_api_contracts/backend_api_contracts.dart';

/// generated backend SDK 的薄包装。
///
/// 接受一个已配置好的 [Dio]（携带 mobile baseUrl / Bearer token /
/// [ApiException] 归一行为），交给 generated [BackendApiContracts]，使 generated
/// SDK 与手写 `ApiClient` 共享同一网络行为。
class GeneratedBackendApi {
  GeneratedBackendApi({required Dio dio})
      : dio = dio,
        client = BackendApiContracts(dio: dio);

  final Dio dio;
  final BackendApiContracts client;
}
