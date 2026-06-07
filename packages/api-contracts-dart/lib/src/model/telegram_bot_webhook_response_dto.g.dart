// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'telegram_bot_webhook_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$TelegramBotWebhookResponseDto extends TelegramBotWebhookResponseDto {
  @override
  final bool ok;

  factory _$TelegramBotWebhookResponseDto([
    void Function(TelegramBotWebhookResponseDtoBuilder)? updates,
  ]) => (TelegramBotWebhookResponseDtoBuilder()..update(updates))._build();

  _$TelegramBotWebhookResponseDto._({required this.ok}) : super._();
  @override
  TelegramBotWebhookResponseDto rebuild(
    void Function(TelegramBotWebhookResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  TelegramBotWebhookResponseDtoBuilder toBuilder() =>
      TelegramBotWebhookResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is TelegramBotWebhookResponseDto && ok == other.ok;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, ok.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'TelegramBotWebhookResponseDto',
    )..add('ok', ok)).toString();
  }
}

class TelegramBotWebhookResponseDtoBuilder
    implements
        Builder<
          TelegramBotWebhookResponseDto,
          TelegramBotWebhookResponseDtoBuilder
        > {
  _$TelegramBotWebhookResponseDto? _$v;

  bool? _ok;
  bool? get ok => _$this._ok;
  set ok(bool? ok) => _$this._ok = ok;

  TelegramBotWebhookResponseDtoBuilder() {
    TelegramBotWebhookResponseDto._defaults(this);
  }

  TelegramBotWebhookResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _ok = $v.ok;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(TelegramBotWebhookResponseDto other) {
    _$v = other as _$TelegramBotWebhookResponseDto;
  }

  @override
  void update(void Function(TelegramBotWebhookResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  TelegramBotWebhookResponseDto build() => _build();

  _$TelegramBotWebhookResponseDto _build() {
    final _$result =
        _$v ??
        _$TelegramBotWebhookResponseDto._(
          ok: BuiltValueNullFieldError.checkNotNull(
            ok,
            r'TelegramBotWebhookResponseDto',
            'ok',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
