// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_refresh_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminRefreshDto extends AdminRefreshDto {
  @override
  final String refreshToken;

  factory _$AdminRefreshDto([void Function(AdminRefreshDtoBuilder)? updates]) =>
      (AdminRefreshDtoBuilder()..update(updates))._build();

  _$AdminRefreshDto._({required this.refreshToken}) : super._();
  @override
  AdminRefreshDto rebuild(void Function(AdminRefreshDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  AdminRefreshDtoBuilder toBuilder() => AdminRefreshDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminRefreshDto && refreshToken == other.refreshToken;
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
      r'AdminRefreshDto',
    )..add('refreshToken', refreshToken)).toString();
  }
}

class AdminRefreshDtoBuilder
    implements Builder<AdminRefreshDto, AdminRefreshDtoBuilder> {
  _$AdminRefreshDto? _$v;

  String? _refreshToken;
  String? get refreshToken => _$this._refreshToken;
  set refreshToken(String? refreshToken) => _$this._refreshToken = refreshToken;

  AdminRefreshDtoBuilder() {
    AdminRefreshDto._defaults(this);
  }

  AdminRefreshDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _refreshToken = $v.refreshToken;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminRefreshDto other) {
    _$v = other as _$AdminRefreshDto;
  }

  @override
  void update(void Function(AdminRefreshDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AdminRefreshDto build() => _build();

  _$AdminRefreshDto _build() {
    final _$result =
        _$v ??
        _$AdminRefreshDto._(
          refreshToken: BuiltValueNullFieldError.checkNotNull(
            refreshToken,
            r'AdminRefreshDto',
            'refreshToken',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
