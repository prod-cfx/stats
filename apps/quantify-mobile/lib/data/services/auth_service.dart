import 'package:backend_api_contracts/backend_api_contracts.dart';

import 'generated_backend_api.dart';

/// 鉴权后端资源（issue #2425）。stateless：只持有 generated backend SDK。
///
/// 路径与请求体统一来自 `packages/api-contracts-dart`，避免 mobile 手写 auth
/// endpoint 与真实 OpenAPI 契约漂移。响应映射由 [ApiAuthRepository] 完成。
class AuthService {
  AuthService(this._backend);

  final GeneratedBackendApi _backend;

  AuthApi get _auth => _backend.client.getAuthApi();

  Future<dynamic> login({
    required String email,
    required String password,
  }) async {
    final response = await _auth.authControllerLogin(
      loginRequestDto: LoginRequestDto(
        (b) => b
          ..email = email
          ..password = password,
      ),
    );
    return response.data;
  }

  Future<dynamic> register({
    required String email,
    required String password,
    String? nickname,
    String? betaCode,
  }) async {
    final response = await _auth.authControllerRegister(
      registerRequestDto: RegisterRequestDto((b) {
        b
          ..email = email
          ..password = password;
        if (nickname != null && nickname.isNotEmpty) b.nickname = nickname;
        if (betaCode != null && betaCode.isNotEmpty) b.betaCode = betaCode;
      }),
    );
    return response.data;
  }

  Future<void> sendLoginCode({required String email}) async {
    await _auth.authControllerSendEmailLoginCode(
      sendEmailLoginCodeRequestDto: SendEmailLoginCodeRequestDto(
        (b) => b.email = email,
      ),
    );
  }

  Future<dynamic> loginWithCode({
    required String email,
    required String code,
  }) async {
    final response = await _auth.authControllerVerifyEmailLoginCode(
      verifyEmailLoginCodeRequestDto: VerifyEmailLoginCodeRequestDto(
        (b) => b
          ..email = email
          ..code = code,
      ),
    );
    return response.data;
  }

  Future<dynamic> loginTelegram({
    Map<String, dynamic> payload = const <String, dynamic>{},
  }) async {
    final response = await _auth.authControllerTelegramExchange(
      telegramExchangeRequestDto: TelegramExchangeRequestDto((b) {
        b
          ..telegramId = _payloadString(payload, 'telegramId')
          ..authDate = _payloadString(payload, 'authDate')
          ..hash = _payloadString(payload, 'hash')
          ..source_ = _telegramSource(_payloadString(payload, 'source'));
        final String firstName = _payloadString(payload, 'firstName');
        final String lastName = _payloadString(payload, 'lastName');
        final String username = _payloadString(payload, 'username');
        final String photoUrl = _payloadString(payload, 'photoUrl');
        final String betaCode = _payloadString(payload, 'betaCode');
        if (firstName.isNotEmpty) b.firstName = firstName;
        if (lastName.isNotEmpty) b.lastName = lastName;
        if (username.isNotEmpty) b.username = username;
        if (photoUrl.isNotEmpty) b.photoUrl = photoUrl;
        if (betaCode.isNotEmpty) b.betaCode = betaCode;
      }),
    );
    return response.data;
  }

  Future<dynamic> loginGuest() async {
    final response = await _auth.authControllerLoginGuest();
    return response.data;
  }

  Future<dynamic> me() async {
    final response = await _backend.client.getUsersApi().userControllerMe();
    return response.data;
  }
}

String _payloadString(Map<String, dynamic> payload, String key) {
  final Object? value = payload[key];
  return value == null ? '' : value.toString();
}

TelegramExchangeRequestDtoSource_Enum _telegramSource(String value) {
  return switch (value) {
    'web' => TelegramExchangeRequestDtoSource_Enum.web,
    'desktop' => TelegramExchangeRequestDtoSource_Enum.desktop,
    _ => TelegramExchangeRequestDtoSource_Enum.webapp,
  };
}
