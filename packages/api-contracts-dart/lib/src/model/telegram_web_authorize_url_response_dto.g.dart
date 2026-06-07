// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'telegram_web_authorize_url_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$TelegramWebAuthorizeUrlResponseDto
    extends TelegramWebAuthorizeUrlResponseDto {
  @override
  final String authorizeUrl;

  factory _$TelegramWebAuthorizeUrlResponseDto([
    void Function(TelegramWebAuthorizeUrlResponseDtoBuilder)? updates,
  ]) => (TelegramWebAuthorizeUrlResponseDtoBuilder()..update(updates))._build();

  _$TelegramWebAuthorizeUrlResponseDto._({required this.authorizeUrl})
    : super._();
  @override
  TelegramWebAuthorizeUrlResponseDto rebuild(
    void Function(TelegramWebAuthorizeUrlResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  TelegramWebAuthorizeUrlResponseDtoBuilder toBuilder() =>
      TelegramWebAuthorizeUrlResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is TelegramWebAuthorizeUrlResponseDto &&
        authorizeUrl == other.authorizeUrl;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, authorizeUrl.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'TelegramWebAuthorizeUrlResponseDto',
    )..add('authorizeUrl', authorizeUrl)).toString();
  }
}

class TelegramWebAuthorizeUrlResponseDtoBuilder
    implements
        Builder<
          TelegramWebAuthorizeUrlResponseDto,
          TelegramWebAuthorizeUrlResponseDtoBuilder
        > {
  _$TelegramWebAuthorizeUrlResponseDto? _$v;

  String? _authorizeUrl;
  String? get authorizeUrl => _$this._authorizeUrl;
  set authorizeUrl(String? authorizeUrl) => _$this._authorizeUrl = authorizeUrl;

  TelegramWebAuthorizeUrlResponseDtoBuilder() {
    TelegramWebAuthorizeUrlResponseDto._defaults(this);
  }

  TelegramWebAuthorizeUrlResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _authorizeUrl = $v.authorizeUrl;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(TelegramWebAuthorizeUrlResponseDto other) {
    _$v = other as _$TelegramWebAuthorizeUrlResponseDto;
  }

  @override
  void update(
    void Function(TelegramWebAuthorizeUrlResponseDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  TelegramWebAuthorizeUrlResponseDto build() => _build();

  _$TelegramWebAuthorizeUrlResponseDto _build() {
    final _$result =
        _$v ??
        _$TelegramWebAuthorizeUrlResponseDto._(
          authorizeUrl: BuiltValueNullFieldError.checkNotNull(
            authorizeUrl,
            r'TelegramWebAuthorizeUrlResponseDto',
            'authorizeUrl',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
