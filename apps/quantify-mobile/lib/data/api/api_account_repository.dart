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

  static AccountInfo mapProfile(
    UserProfileResponseDto dto, {
    AccountTelegramBinding? telegram,
  }) {
    return AccountInfo(
      userId: dto.id,
      email: dto.email,
      uid: dto.id,
      telegram: telegram,
      totalEquityUsd: 0,
      availableBalanceUsd: 0,
      unrealizedPnlUsd: 0,
    );
  }

  static AccountTelegramBinding? mapTelegramBinding(Object? raw) {
    if (raw is! Map) return null;
    final Object? linked = raw['isLinked'];
    final Object? id = raw['id'];
    if (linked != true || id == null || id.toString().trim().isEmpty) {
      return null;
    }
    final Object? username = raw['username'];
    final String? normalizedUsername =
        username == null || username.toString().trim().isEmpty
        ? null
        : username.toString().trim().replaceFirst(RegExp(r'^@'), '');
    return AccountTelegramBinding(
      id: id.toString().trim(),
      username: normalizedUsername,
      isLinked: true,
    );
  }

  Map<Object?, Object?> _payloadMap(Object? raw) {
    if (raw is Map && raw['data'] is Map) return raw['data'] as Map;
    if (raw is Map) return raw;
    return const <Object?, Object?>{};
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
    final Map<Object?, Object?> payload = _payloadMap(response.data);
    return mapProfile(
      _deserializeProfile(response.data),
      telegram: mapTelegramBinding(payload['telegram']),
    );
  }

  @override
  Stream<AccountInfo> watchInfo() async* {
    yield await getInfo();
    yield* Stream<void>.periodic(
      const Duration(seconds: 5),
    ).asyncMap((_) => getInfo());
  }
}
