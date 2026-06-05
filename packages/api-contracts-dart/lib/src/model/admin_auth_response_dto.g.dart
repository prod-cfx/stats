// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_auth_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminAuthResponseDto extends AdminAuthResponseDto {
  @override
  final String accessToken;
  @override
  final String? refreshToken;
  @override
  final String? expiresIn;
  @override
  final AdminProfileDto admin;

  factory _$AdminAuthResponseDto([
    void Function(AdminAuthResponseDtoBuilder)? updates,
  ]) => (AdminAuthResponseDtoBuilder()..update(updates))._build();

  _$AdminAuthResponseDto._({
    required this.accessToken,
    this.refreshToken,
    this.expiresIn,
    required this.admin,
  }) : super._();
  @override
  AdminAuthResponseDto rebuild(
    void Function(AdminAuthResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminAuthResponseDtoBuilder toBuilder() =>
      AdminAuthResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminAuthResponseDto &&
        accessToken == other.accessToken &&
        refreshToken == other.refreshToken &&
        expiresIn == other.expiresIn &&
        admin == other.admin;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, accessToken.hashCode);
    _$hash = $jc(_$hash, refreshToken.hashCode);
    _$hash = $jc(_$hash, expiresIn.hashCode);
    _$hash = $jc(_$hash, admin.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AdminAuthResponseDto')
          ..add('accessToken', accessToken)
          ..add('refreshToken', refreshToken)
          ..add('expiresIn', expiresIn)
          ..add('admin', admin))
        .toString();
  }
}

class AdminAuthResponseDtoBuilder
    implements Builder<AdminAuthResponseDto, AdminAuthResponseDtoBuilder> {
  _$AdminAuthResponseDto? _$v;

  String? _accessToken;
  String? get accessToken => _$this._accessToken;
  set accessToken(String? accessToken) => _$this._accessToken = accessToken;

  String? _refreshToken;
  String? get refreshToken => _$this._refreshToken;
  set refreshToken(String? refreshToken) => _$this._refreshToken = refreshToken;

  String? _expiresIn;
  String? get expiresIn => _$this._expiresIn;
  set expiresIn(String? expiresIn) => _$this._expiresIn = expiresIn;

  AdminProfileDtoBuilder? _admin;
  AdminProfileDtoBuilder get admin =>
      _$this._admin ??= AdminProfileDtoBuilder();
  set admin(AdminProfileDtoBuilder? admin) => _$this._admin = admin;

  AdminAuthResponseDtoBuilder() {
    AdminAuthResponseDto._defaults(this);
  }

  AdminAuthResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _accessToken = $v.accessToken;
      _refreshToken = $v.refreshToken;
      _expiresIn = $v.expiresIn;
      _admin = $v.admin.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminAuthResponseDto other) {
    _$v = other as _$AdminAuthResponseDto;
  }

  @override
  void update(void Function(AdminAuthResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AdminAuthResponseDto build() => _build();

  _$AdminAuthResponseDto _build() {
    _$AdminAuthResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$AdminAuthResponseDto._(
            accessToken: BuiltValueNullFieldError.checkNotNull(
              accessToken,
              r'AdminAuthResponseDto',
              'accessToken',
            ),
            refreshToken: refreshToken,
            expiresIn: expiresIn,
            admin: admin.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'admin';
        admin.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AdminAuthResponseDto',
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
