// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_user_controller_login0200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminUserControllerLogin0200Response
    extends AdminUserControllerLogin0200Response {
  @override
  final String? accessToken;
  @override
  final String? refreshToken;
  @override
  final String? expiresIn;
  @override
  final AdminUserDto? user;

  factory _$AdminUserControllerLogin0200Response([
    void Function(AdminUserControllerLogin0200ResponseBuilder)? updates,
  ]) =>
      (AdminUserControllerLogin0200ResponseBuilder()..update(updates))._build();

  _$AdminUserControllerLogin0200Response._({
    this.accessToken,
    this.refreshToken,
    this.expiresIn,
    this.user,
  }) : super._();
  @override
  AdminUserControllerLogin0200Response rebuild(
    void Function(AdminUserControllerLogin0200ResponseBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminUserControllerLogin0200ResponseBuilder toBuilder() =>
      AdminUserControllerLogin0200ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminUserControllerLogin0200Response &&
        accessToken == other.accessToken &&
        refreshToken == other.refreshToken &&
        expiresIn == other.expiresIn &&
        user == other.user;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, accessToken.hashCode);
    _$hash = $jc(_$hash, refreshToken.hashCode);
    _$hash = $jc(_$hash, expiresIn.hashCode);
    _$hash = $jc(_$hash, user.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AdminUserControllerLogin0200Response')
          ..add('accessToken', accessToken)
          ..add('refreshToken', refreshToken)
          ..add('expiresIn', expiresIn)
          ..add('user', user))
        .toString();
  }
}

class AdminUserControllerLogin0200ResponseBuilder
    implements
        Builder<
          AdminUserControllerLogin0200Response,
          AdminUserControllerLogin0200ResponseBuilder
        > {
  _$AdminUserControllerLogin0200Response? _$v;

  String? _accessToken;
  String? get accessToken => _$this._accessToken;
  set accessToken(String? accessToken) => _$this._accessToken = accessToken;

  String? _refreshToken;
  String? get refreshToken => _$this._refreshToken;
  set refreshToken(String? refreshToken) => _$this._refreshToken = refreshToken;

  String? _expiresIn;
  String? get expiresIn => _$this._expiresIn;
  set expiresIn(String? expiresIn) => _$this._expiresIn = expiresIn;

  AdminUserDtoBuilder? _user;
  AdminUserDtoBuilder get user => _$this._user ??= AdminUserDtoBuilder();
  set user(AdminUserDtoBuilder? user) => _$this._user = user;

  AdminUserControllerLogin0200ResponseBuilder() {
    AdminUserControllerLogin0200Response._defaults(this);
  }

  AdminUserControllerLogin0200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _accessToken = $v.accessToken;
      _refreshToken = $v.refreshToken;
      _expiresIn = $v.expiresIn;
      _user = $v.user?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminUserControllerLogin0200Response other) {
    _$v = other as _$AdminUserControllerLogin0200Response;
  }

  @override
  void update(
    void Function(AdminUserControllerLogin0200ResponseBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AdminUserControllerLogin0200Response build() => _build();

  _$AdminUserControllerLogin0200Response _build() {
    _$AdminUserControllerLogin0200Response _$result;
    try {
      _$result =
          _$v ??
          _$AdminUserControllerLogin0200Response._(
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresIn: expiresIn,
            user: _user?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'user';
        _user?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AdminUserControllerLogin0200Response',
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
