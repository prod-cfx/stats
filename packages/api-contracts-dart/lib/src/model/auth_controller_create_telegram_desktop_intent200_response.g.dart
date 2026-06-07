// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_controller_create_telegram_desktop_intent200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AuthControllerCreateTelegramDesktopIntent200Response
    extends AuthControllerCreateTelegramDesktopIntent200Response {
  @override
  final TelegramDesktopIntentResponseDto data;
  @override
  final String? message;

  factory _$AuthControllerCreateTelegramDesktopIntent200Response([
    void Function(AuthControllerCreateTelegramDesktopIntent200ResponseBuilder)?
    updates,
  ]) =>
      (AuthControllerCreateTelegramDesktopIntent200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AuthControllerCreateTelegramDesktopIntent200Response._({
    required this.data,
    this.message,
  }) : super._();
  @override
  AuthControllerCreateTelegramDesktopIntent200Response rebuild(
    void Function(AuthControllerCreateTelegramDesktopIntent200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AuthControllerCreateTelegramDesktopIntent200ResponseBuilder toBuilder() =>
      AuthControllerCreateTelegramDesktopIntent200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AuthControllerCreateTelegramDesktopIntent200Response &&
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
            r'AuthControllerCreateTelegramDesktopIntent200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class AuthControllerCreateTelegramDesktopIntent200ResponseBuilder
    implements
        Builder<
          AuthControllerCreateTelegramDesktopIntent200Response,
          AuthControllerCreateTelegramDesktopIntent200ResponseBuilder
        > {
  _$AuthControllerCreateTelegramDesktopIntent200Response? _$v;

  TelegramDesktopIntentResponseDtoBuilder? _data;
  TelegramDesktopIntentResponseDtoBuilder get data =>
      _$this._data ??= TelegramDesktopIntentResponseDtoBuilder();
  set data(TelegramDesktopIntentResponseDtoBuilder? data) =>
      _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  AuthControllerCreateTelegramDesktopIntent200ResponseBuilder() {
    AuthControllerCreateTelegramDesktopIntent200Response._defaults(this);
  }

  AuthControllerCreateTelegramDesktopIntent200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AuthControllerCreateTelegramDesktopIntent200Response other) {
    _$v = other as _$AuthControllerCreateTelegramDesktopIntent200Response;
  }

  @override
  void update(
    void Function(AuthControllerCreateTelegramDesktopIntent200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AuthControllerCreateTelegramDesktopIntent200Response build() => _build();

  _$AuthControllerCreateTelegramDesktopIntent200Response _build() {
    _$AuthControllerCreateTelegramDesktopIntent200Response _$result;
    try {
      _$result =
          _$v ??
          _$AuthControllerCreateTelegramDesktopIntent200Response._(
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
          r'AuthControllerCreateTelegramDesktopIntent200Response',
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
