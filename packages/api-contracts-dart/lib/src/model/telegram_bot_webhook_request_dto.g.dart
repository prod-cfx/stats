// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'telegram_bot_webhook_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$TelegramBotWebhookRequestDto extends TelegramBotWebhookRequestDto {
  @override
  final BuiltMap<String, JsonObject?>? message;
  @override
  final BuiltMap<String, JsonObject?>? editedMessage;

  factory _$TelegramBotWebhookRequestDto([
    void Function(TelegramBotWebhookRequestDtoBuilder)? updates,
  ]) => (TelegramBotWebhookRequestDtoBuilder()..update(updates))._build();

  _$TelegramBotWebhookRequestDto._({this.message, this.editedMessage})
    : super._();
  @override
  TelegramBotWebhookRequestDto rebuild(
    void Function(TelegramBotWebhookRequestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  TelegramBotWebhookRequestDtoBuilder toBuilder() =>
      TelegramBotWebhookRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is TelegramBotWebhookRequestDto &&
        message == other.message &&
        editedMessage == other.editedMessage;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, message.hashCode);
    _$hash = $jc(_$hash, editedMessage.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'TelegramBotWebhookRequestDto')
          ..add('message', message)
          ..add('editedMessage', editedMessage))
        .toString();
  }
}

class TelegramBotWebhookRequestDtoBuilder
    implements
        Builder<
          TelegramBotWebhookRequestDto,
          TelegramBotWebhookRequestDtoBuilder
        > {
  _$TelegramBotWebhookRequestDto? _$v;

  MapBuilder<String, JsonObject?>? _message;
  MapBuilder<String, JsonObject?> get message =>
      _$this._message ??= MapBuilder<String, JsonObject?>();
  set message(MapBuilder<String, JsonObject?>? message) =>
      _$this._message = message;

  MapBuilder<String, JsonObject?>? _editedMessage;
  MapBuilder<String, JsonObject?> get editedMessage =>
      _$this._editedMessage ??= MapBuilder<String, JsonObject?>();
  set editedMessage(MapBuilder<String, JsonObject?>? editedMessage) =>
      _$this._editedMessage = editedMessage;

  TelegramBotWebhookRequestDtoBuilder() {
    TelegramBotWebhookRequestDto._defaults(this);
  }

  TelegramBotWebhookRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _message = $v.message?.toBuilder();
      _editedMessage = $v.editedMessage?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(TelegramBotWebhookRequestDto other) {
    _$v = other as _$TelegramBotWebhookRequestDto;
  }

  @override
  void update(void Function(TelegramBotWebhookRequestDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  TelegramBotWebhookRequestDto build() => _build();

  _$TelegramBotWebhookRequestDto _build() {
    _$TelegramBotWebhookRequestDto _$result;
    try {
      _$result =
          _$v ??
          _$TelegramBotWebhookRequestDto._(
            message: _message?.build(),
            editedMessage: _editedMessage?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'message';
        _message?.build();
        _$failedField = 'editedMessage';
        _editedMessage?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'TelegramBotWebhookRequestDto',
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
