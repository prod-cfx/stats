import 'dart:async';

import 'package:backend_api_contracts/backend_api_contracts.dart';

import '../models/account_models.dart';
import '../repositories/account_repository.dart';
import '../services/generated_backend_api.dart';

/// [AccountRepository] 真实现（issue #2189）。
///
/// `watchInfo` 后端暂无推送契约，用周期轮询取最新账户快照。
class ApiAccountRepository implements AccountRepository {
  ApiAccountRepository(this._api);

  final GeneratedBackendApi _api;

  static AccountInfo mapProfile(UserProfileResponseDto dto) {
    return AccountInfo(
      userId: dto.id,
      email: dto.email,
      uid: dto.id,
      totalEquityUsd: 0,
      availableBalanceUsd: 0,
      unrealizedPnlUsd: 0,
    );
  }

  UserProfileResponseDto _deserializeProfile(Object? raw) {
    final Object? payload = raw is Map && raw['data'] != null
        ? raw['data']
        : raw;
    final UserProfileResponseDto? profile = payload is UserProfileResponseDto
        ? payload
        : _api.client.serializers.deserializeWith(
            UserProfileResponseDto.serializer,
            payload,
          );
    if (profile == null) {
      throw StateError('GET /users/me returned empty profile');
    }
    return profile;
  }

  @override
  Future<AccountInfo> getInfo() async {
    final Response<Object?> response = await _api.dio.get<Object?>('/users/me');
    return mapProfile(_deserializeProfile(response.data));
  }

  @override
  Stream<AccountInfo> watchInfo() async* {
    yield await getInfo();
    yield* Stream<void>.periodic(
      const Duration(seconds: 5),
    ).asyncMap((_) => getInfo());
  }
}
