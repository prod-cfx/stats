// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_controller_handle_telegram_bot_webhook200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AuthControllerHandleTelegramBotWebhook200Response
    extends AuthControllerHandleTelegramBotWebhook200Response {
  @override
  final TelegramBotWebhookResponseDto data;
  @override
  final String? message;

  factory _$AuthControllerHandleTelegramBotWebhook200Response([
    void Function(AuthControllerHandleTelegramBotWebhook200ResponseBuilder)?
    updates,
  ]) =>
      (AuthControllerHandleTelegramBotWebhook200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AuthControllerHandleTelegramBotWebhook200Response._({
    required this.data,
    this.message,
  }) : super._();
  @override
  AuthControllerHandleTelegramBotWebhook200Response rebuild(
    void Function(AuthControllerHandleTelegramBotWebhook200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AuthControllerHandleTelegramBotWebhook200ResponseBuilder toBuilder() =>
      AuthControllerHandleTelegramBotWebhook200ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AuthControllerHandleTelegramBotWebhook200Response &&
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
            r'AuthControllerHandleTelegramBotWebhook200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class AuthControllerHandleTelegramBotWebhook200ResponseBuilder
    implements
        Builder<
          AuthControllerHandleTelegramBotWebhook200Response,
          AuthControllerHandleTelegramBotWebhook200ResponseBuilder
        > {
  _$AuthControllerHandleTelegramBotWebhook200Response? _$v;

  TelegramBotWebhookResponseDtoBuilder? _data;
  TelegramBotWebhookResponseDtoBuilder get data =>
      _$this._data ??= TelegramBotWebhookResponseDtoBuilder();
  set data(TelegramBotWebhookResponseDtoBuilder? data) => _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  AuthControllerHandleTelegramBotWebhook200ResponseBuilder() {
    AuthControllerHandleTelegramBotWebhook200Response._defaults(this);
  }

  AuthControllerHandleTelegramBotWebhook200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AuthControllerHandleTelegramBotWebhook200Response other) {
    _$v = other as _$AuthControllerHandleTelegramBotWebhook200Response;
  }

  @override
  void update(
    void Function(AuthControllerHandleTelegramBotWebhook200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AuthControllerHandleTelegramBotWebhook200Response build() => _build();

  _$AuthControllerHandleTelegramBotWebhook200Response _build() {
    _$AuthControllerHandleTelegramBotWebhook200Response _$result;
    try {
      _$result =
          _$v ??
          _$AuthControllerHandleTelegramBotWebhook200Response._(
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
          r'AuthControllerHandleTelegramBotWebhook200Response',
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
