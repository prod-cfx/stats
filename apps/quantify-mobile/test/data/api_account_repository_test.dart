import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_account_repository.dart';
import 'package:quantify_mobile/data/models/account_models.dart';
import 'package:quantify_mobile/data/services/generated_backend_api.dart';

class _UsersMeInterceptor extends Interceptor {
  _UsersMeInterceptor(this.calls);

  final List<String> calls;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    calls.add(options.path);
    if (options.path != '/users/me') {
      throw StateError('unexpected HTTP call: ${options.path}');
    }
    handler.resolve(
      Response<Object>(
        requestOptions: options,
        statusCode: 200,
        data: <String, Object>{
          'data': <String, Object>{
            'id': 'cmp42glf60001yxqs0ivc09ff',
            'email': 'victor@example.com',
            'emailVerified': true,
            'isGuest': false,
            'roles': <String>['user'],
            'createdAt': '2026-06-08T00:00:00.000Z',
            'updatedAt': '2026-06-08T00:00:00.000Z',
          },
          'message': 'ok',
        },
      ),
    );
  }
}

UserProfileResponseDto _profileDto() {
  final DateTime now = DateTime.utc(2026, 6, 8);
  return UserProfileResponseDto(
    (UserProfileResponseDtoBuilder b) => b
      ..id = 'cmp42glf60001yxqs0ivc09ff'
      ..email = 'victor@example.com'
      ..emailVerified = true
      ..isGuest = false
      ..roles.add('user')
      ..createdAt = now
      ..updatedAt = now,
  );
}

void main() {
  group('ApiAccountRepository', () {
    test('maps UserProfileResponseDto.id to both userId and uid', () {
      final AccountInfo info = ApiAccountRepository.mapProfile(_profileDto());

      expect(info.userId, 'cmp42glf60001yxqs0ivc09ff');
      expect(info.uid, 'cmp42glf60001yxqs0ivc09ff');
      expect(info.email, 'victor@example.com');
      expect(info.totalEquityUsd, 0);
      expect(info.availableBalanceUsd, 0);
      expect(info.unrealizedPnlUsd, 0);
    });

    test(
      'getInfo unwraps backend envelope and deserializes typed profile',
      () async {
        final List<String> calls = <String>[];
        final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'));
        dio.interceptors.add(_UsersMeInterceptor(calls));
        final ApiAccountRepository repo = ApiAccountRepository(
          GeneratedBackendApi(dio: dio),
        );

        final AccountInfo info = await repo.getInfo();

        expect(calls, <String>['/users/me']);
        expect(info.uid, 'cmp42glf60001yxqs0ivc09ff');
        expect(info.userId, info.uid);
      },
    );
  });
}
