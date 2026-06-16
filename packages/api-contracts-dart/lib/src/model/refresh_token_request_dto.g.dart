// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'refresh_token_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$RefreshTokenRequestDto extends RefreshTokenRequestDto {
  @override
  final String refreshToken;

  factory _$RefreshTokenRequestDto([
    void Function(RefreshTokenRequestDtoBuilder)? updates,
  ]) => (RefreshTokenRequestDtoBuilder()..update(updates))._build();

  _$RefreshTokenRequestDto._({required this.refreshToken}) : super._();
  @override
  RefreshTokenRequestDto rebuild(
    void Function(RefreshTokenRequestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  RefreshTokenRequestDtoBuilder toBuilder() =>
      RefreshTokenRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is RefreshTokenRequestDto &&
        refreshToken == other.refreshToken;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, refreshToken.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'RefreshTokenRequestDto',
    )..add('refreshToken', refreshToken)).toString();
  }
}

class RefreshTokenRequestDtoBuilder
    implements Builder<RefreshTokenRequestDto, RefreshTokenRequestDtoBuilder> {
  _$RefreshTokenRequestDto? _$v;

  String? _refreshToken;
  String? get refreshToken => _$this._refreshToken;
  set refreshToken(String? refreshToken) => _$this._refreshToken = refreshToken;

  RefreshTokenRequestDtoBuilder() {
    RefreshTokenRequestDto._defaults(this);
  }

  RefreshTokenRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _refreshToken = $v.refreshToken;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(RefreshTokenRequestDto other) {
    _$v = other as _$RefreshTokenRequestDto;
  }

  @override
  void update(void Function(RefreshTokenRequestDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  RefreshTokenRequestDto build() => _build();

  _$RefreshTokenRequestDto _build() {
    final _$result =
        _$v ??
        _$RefreshTokenRequestDto._(
          refreshToken: BuiltValueNullFieldError.checkNotNull(
            refreshToken,
            r'RefreshTokenRequestDto',
            'refreshToken',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
