// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_controller_get_telegram_login_config200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AuthControllerGetTelegramLoginConfig200Response
    extends AuthControllerGetTelegramLoginConfig200Response {
  @override
  final AuthControllerGetTelegramLoginConfig200ResponseData? data;
  @override
  final String? message;

  factory _$AuthControllerGetTelegramLoginConfig200Response([
    void Function(AuthControllerGetTelegramLoginConfig200ResponseBuilder)?
    updates,
  ]) =>
      (AuthControllerGetTelegramLoginConfig200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AuthControllerGetTelegramLoginConfig200Response._({this.data, this.message})
    : super._();
  @override
  AuthControllerGetTelegramLoginConfig200Response rebuild(
    void Function(AuthControllerGetTelegramLoginConfig200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AuthControllerGetTelegramLoginConfig200ResponseBuilder toBuilder() =>
      AuthControllerGetTelegramLoginConfig200ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AuthControllerGetTelegramLoginConfig200Response &&
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
            r'AuthControllerGetTelegramLoginConfig200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class AuthControllerGetTelegramLoginConfig200ResponseBuilder
    implements
        Builder<
          AuthControllerGetTelegramLoginConfig200Response,
          AuthControllerGetTelegramLoginConfig200ResponseBuilder
        > {
  _$AuthControllerGetTelegramLoginConfig200Response? _$v;

  AuthControllerGetTelegramLoginConfig200ResponseDataBuilder? _data;
  AuthControllerGetTelegramLoginConfig200ResponseDataBuilder get data =>
      _$this._data ??=
          AuthControllerGetTelegramLoginConfig200ResponseDataBuilder();
  set data(AuthControllerGetTelegramLoginConfig200ResponseDataBuilder? data) =>
      _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  AuthControllerGetTelegramLoginConfig200ResponseBuilder() {
    AuthControllerGetTelegramLoginConfig200Response._defaults(this);
  }

  AuthControllerGetTelegramLoginConfig200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data?.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AuthControllerGetTelegramLoginConfig200Response other) {
    _$v = other as _$AuthControllerGetTelegramLoginConfig200Response;
  }

  @override
  void update(
    void Function(AuthControllerGetTelegramLoginConfig200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AuthControllerGetTelegramLoginConfig200Response build() => _build();

  _$AuthControllerGetTelegramLoginConfig200Response _build() {
    _$AuthControllerGetTelegramLoginConfig200Response _$result;
    try {
      _$result =
          _$v ??
          _$AuthControllerGetTelegramLoginConfig200Response._(
            data: _data?.build(),
            message: message,
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'data';
        _data?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AuthControllerGetTelegramLoginConfig200Response',
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
