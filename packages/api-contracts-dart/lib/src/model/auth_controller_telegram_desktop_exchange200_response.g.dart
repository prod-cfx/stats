// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_controller_telegram_desktop_exchange200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AuthControllerTelegramDesktopExchange200Response
    extends AuthControllerTelegramDesktopExchange200Response {
  @override
  final AuthResponseDto data;
  @override
  final String? message;

  factory _$AuthControllerTelegramDesktopExchange200Response([
    void Function(AuthControllerTelegramDesktopExchange200ResponseBuilder)?
    updates,
  ]) =>
      (AuthControllerTelegramDesktopExchange200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AuthControllerTelegramDesktopExchange200Response._({
    required this.data,
    this.message,
  }) : super._();
  @override
  AuthControllerTelegramDesktopExchange200Response rebuild(
    void Function(AuthControllerTelegramDesktopExchange200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AuthControllerTelegramDesktopExchange200ResponseBuilder toBuilder() =>
      AuthControllerTelegramDesktopExchange200ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AuthControllerTelegramDesktopExchange200Response &&
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
            r'AuthControllerTelegramDesktopExchange200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class AuthControllerTelegramDesktopExchange200ResponseBuilder
    implements
        Builder<
          AuthControllerTelegramDesktopExchange200Response,
          AuthControllerTelegramDesktopExchange200ResponseBuilder
        > {
  _$AuthControllerTelegramDesktopExchange200Response? _$v;

  AuthResponseDtoBuilder? _data;
  AuthResponseDtoBuilder get data => _$this._data ??= AuthResponseDtoBuilder();
  set data(AuthResponseDtoBuilder? data) => _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  AuthControllerTelegramDesktopExchange200ResponseBuilder() {
    AuthControllerTelegramDesktopExchange200Response._defaults(this);
  }

  AuthControllerTelegramDesktopExchange200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AuthControllerTelegramDesktopExchange200Response other) {
    _$v = other as _$AuthControllerTelegramDesktopExchange200Response;
  }

  @override
  void update(
    void Function(AuthControllerTelegramDesktopExchange200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AuthControllerTelegramDesktopExchange200Response build() => _build();

  _$AuthControllerTelegramDesktopExchange200Response _build() {
    _$AuthControllerTelegramDesktopExchange200Response _$result;
    try {
      _$result =
          _$v ??
          _$AuthControllerTelegramDesktopExchange200Response._(
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
          r'AuthControllerTelegramDesktopExchange200Response',
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
