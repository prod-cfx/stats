// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'telegram_desktop_intent_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$TelegramDesktopIntentResponseDto
    extends TelegramDesktopIntentResponseDto {
  @override
  final String intentId;
  @override
  final String deepLink;
  @override
  final String webLink;
  @override
  final String callbackUrl;
  @override
  final num expiresInSeconds;

  factory _$TelegramDesktopIntentResponseDto([
    void Function(TelegramDesktopIntentResponseDtoBuilder)? updates,
  ]) => (TelegramDesktopIntentResponseDtoBuilder()..update(updates))._build();

  _$TelegramDesktopIntentResponseDto._({
    required this.intentId,
    required this.deepLink,
    required this.webLink,
    required this.callbackUrl,
    required this.expiresInSeconds,
  }) : super._();
  @override
  TelegramDesktopIntentResponseDto rebuild(
    void Function(TelegramDesktopIntentResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  TelegramDesktopIntentResponseDtoBuilder toBuilder() =>
      TelegramDesktopIntentResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is TelegramDesktopIntentResponseDto &&
        intentId == other.intentId &&
        deepLink == other.deepLink &&
        webLink == other.webLink &&
        callbackUrl == other.callbackUrl &&
        expiresInSeconds == other.expiresInSeconds;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, intentId.hashCode);
    _$hash = $jc(_$hash, deepLink.hashCode);
    _$hash = $jc(_$hash, webLink.hashCode);
    _$hash = $jc(_$hash, callbackUrl.hashCode);
    _$hash = $jc(_$hash, expiresInSeconds.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'TelegramDesktopIntentResponseDto')
          ..add('intentId', intentId)
          ..add('deepLink', deepLink)
          ..add('webLink', webLink)
          ..add('callbackUrl', callbackUrl)
          ..add('expiresInSeconds', expiresInSeconds))
        .toString();
  }
}

class TelegramDesktopIntentResponseDtoBuilder
    implements
        Builder<
          TelegramDesktopIntentResponseDto,
          TelegramDesktopIntentResponseDtoBuilder
        > {
  _$TelegramDesktopIntentResponseDto? _$v;

  String? _intentId;
  String? get intentId => _$this._intentId;
  set intentId(String? intentId) => _$this._intentId = intentId;

  String? _deepLink;
  String? get deepLink => _$this._deepLink;
  set deepLink(String? deepLink) => _$this._deepLink = deepLink;

  String? _webLink;
  String? get webLink => _$this._webLink;
  set webLink(String? webLink) => _$this._webLink = webLink;

  String? _callbackUrl;
  String? get callbackUrl => _$this._callbackUrl;
  set callbackUrl(String? callbackUrl) => _$this._callbackUrl = callbackUrl;

  num? _expiresInSeconds;
  num? get expiresInSeconds => _$this._expiresInSeconds;
  set expiresInSeconds(num? expiresInSeconds) =>
      _$this._expiresInSeconds = expiresInSeconds;

  TelegramDesktopIntentResponseDtoBuilder() {
    TelegramDesktopIntentResponseDto._defaults(this);
  }

  TelegramDesktopIntentResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _intentId = $v.intentId;
      _deepLink = $v.deepLink;
      _webLink = $v.webLink;
      _callbackUrl = $v.callbackUrl;
      _expiresInSeconds = $v.expiresInSeconds;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(TelegramDesktopIntentResponseDto other) {
    _$v = other as _$TelegramDesktopIntentResponseDto;
  }

  @override
  void update(void Function(TelegramDesktopIntentResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  TelegramDesktopIntentResponseDto build() => _build();

  _$TelegramDesktopIntentResponseDto _build() {
    final _$result =
        _$v ??
        _$TelegramDesktopIntentResponseDto._(
          intentId: BuiltValueNullFieldError.checkNotNull(
            intentId,
            r'TelegramDesktopIntentResponseDto',
            'intentId',
          ),
          deepLink: BuiltValueNullFieldError.checkNotNull(
            deepLink,
            r'TelegramDesktopIntentResponseDto',
            'deepLink',
          ),
          webLink: BuiltValueNullFieldError.checkNotNull(
            webLink,
            r'TelegramDesktopIntentResponseDto',
            'webLink',
          ),
          callbackUrl: BuiltValueNullFieldError.checkNotNull(
            callbackUrl,
            r'TelegramDesktopIntentResponseDto',
            'callbackUrl',
          ),
          expiresInSeconds: BuiltValueNullFieldError.checkNotNull(
            expiresInSeconds,
            r'TelegramDesktopIntentResponseDto',
            'expiresInSeconds',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
