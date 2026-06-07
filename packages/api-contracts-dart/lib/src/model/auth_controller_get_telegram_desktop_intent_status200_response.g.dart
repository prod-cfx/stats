// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_controller_get_telegram_desktop_intent_status200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AuthControllerGetTelegramDesktopIntentStatus200Response
    extends AuthControllerGetTelegramDesktopIntentStatus200Response {
  @override
  final TelegramDesktopIntentStatusResponseDto data;
  @override
  final String? message;

  factory _$AuthControllerGetTelegramDesktopIntentStatus200Response([
    void Function(
      AuthControllerGetTelegramDesktopIntentStatus200ResponseBuilder,
    )?
    updates,
  ]) =>
      (AuthControllerGetTelegramDesktopIntentStatus200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AuthControllerGetTelegramDesktopIntentStatus200Response._({
    required this.data,
    this.message,
  }) : super._();
  @override
  AuthControllerGetTelegramDesktopIntentStatus200Response rebuild(
    void Function(
      AuthControllerGetTelegramDesktopIntentStatus200ResponseBuilder,
    )
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AuthControllerGetTelegramDesktopIntentStatus200ResponseBuilder toBuilder() =>
      AuthControllerGetTelegramDesktopIntentStatus200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AuthControllerGetTelegramDesktopIntentStatus200Response &&
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
            r'AuthControllerGetTelegramDesktopIntentStatus200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class AuthControllerGetTelegramDesktopIntentStatus200ResponseBuilder
    implements
        Builder<
          AuthControllerGetTelegramDesktopIntentStatus200Response,
          AuthControllerGetTelegramDesktopIntentStatus200ResponseBuilder
        > {
  _$AuthControllerGetTelegramDesktopIntentStatus200Response? _$v;

  TelegramDesktopIntentStatusResponseDtoBuilder? _data;
  TelegramDesktopIntentStatusResponseDtoBuilder get data =>
      _$this._data ??= TelegramDesktopIntentStatusResponseDtoBuilder();
  set data(TelegramDesktopIntentStatusResponseDtoBuilder? data) =>
      _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  AuthControllerGetTelegramDesktopIntentStatus200ResponseBuilder() {
    AuthControllerGetTelegramDesktopIntentStatus200Response._defaults(this);
  }

  AuthControllerGetTelegramDesktopIntentStatus200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AuthControllerGetTelegramDesktopIntentStatus200Response other) {
    _$v = other as _$AuthControllerGetTelegramDesktopIntentStatus200Response;
  }

  @override
  void update(
    void Function(
      AuthControllerGetTelegramDesktopIntentStatus200ResponseBuilder,
    )?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AuthControllerGetTelegramDesktopIntentStatus200Response build() => _build();

  _$AuthControllerGetTelegramDesktopIntentStatus200Response _build() {
    _$AuthControllerGetTelegramDesktopIntentStatus200Response _$result;
    try {
      _$result =
          _$v ??
          _$AuthControllerGetTelegramDesktopIntentStatus200Response._(
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
          r'AuthControllerGetTelegramDesktopIntentStatus200Response',
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
