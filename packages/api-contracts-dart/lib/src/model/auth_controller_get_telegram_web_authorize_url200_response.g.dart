// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_controller_get_telegram_web_authorize_url200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AuthControllerGetTelegramWebAuthorizeUrl200Response
    extends AuthControllerGetTelegramWebAuthorizeUrl200Response {
  @override
  final TelegramWebAuthorizeUrlResponseDto data;
  @override
  final String? message;

  factory _$AuthControllerGetTelegramWebAuthorizeUrl200Response([
    void Function(AuthControllerGetTelegramWebAuthorizeUrl200ResponseBuilder)?
    updates,
  ]) =>
      (AuthControllerGetTelegramWebAuthorizeUrl200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AuthControllerGetTelegramWebAuthorizeUrl200Response._({
    required this.data,
    this.message,
  }) : super._();
  @override
  AuthControllerGetTelegramWebAuthorizeUrl200Response rebuild(
    void Function(AuthControllerGetTelegramWebAuthorizeUrl200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AuthControllerGetTelegramWebAuthorizeUrl200ResponseBuilder toBuilder() =>
      AuthControllerGetTelegramWebAuthorizeUrl200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AuthControllerGetTelegramWebAuthorizeUrl200Response &&
        data == other.data &&
        message == other.message;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, data.hashCode);
    _$hash = $jc(_$hash, message.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'AuthControllerGetTelegramWebAuthorizeUrl200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class AuthControllerGetTelegramWebAuthorizeUrl200ResponseBuilder
    implements
        Builder<
          AuthControllerGetTelegramWebAuthorizeUrl200Response,
          AuthControllerGetTelegramWebAuthorizeUrl200ResponseBuilder
        > {
  _$AuthControllerGetTelegramWebAuthorizeUrl200Response? _$v;

  TelegramWebAuthorizeUrlResponseDtoBuilder? _data;
  TelegramWebAuthorizeUrlResponseDtoBuilder get data =>
      _$this._data ??= TelegramWebAuthorizeUrlResponseDtoBuilder();
  set data(TelegramWebAuthorizeUrlResponseDtoBuilder? data) =>
      _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  AuthControllerGetTelegramWebAuthorizeUrl200ResponseBuilder() {
    AuthControllerGetTelegramWebAuthorizeUrl200Response._defaults(this);
  }

  AuthControllerGetTelegramWebAuthorizeUrl200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AuthControllerGetTelegramWebAuthorizeUrl200Response other) {
    _$v = other as _$AuthControllerGetTelegramWebAuthorizeUrl200Response;
  }

  @override
  void update(
    void Function(AuthControllerGetTelegramWebAuthorizeUrl200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AuthControllerGetTelegramWebAuthorizeUrl200Response build() => _build();

  _$AuthControllerGetTelegramWebAuthorizeUrl200Response _build() {
    _$AuthControllerGetTelegramWebAuthorizeUrl200Response _$result;
    try {
      _$result =
          _$v ??
          _$AuthControllerGetTelegramWebAuthorizeUrl200Response._(
            data: data.build(),
            message: message,
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'data';
        data.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AuthControllerGetTelegramWebAuthorizeUrl200Response',
          _$failedField,
          e.toString(),
        );
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
