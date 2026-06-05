// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_login_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminLoginDto extends AdminLoginDto {
  @override
  final String username;
  @override
  final String password;

  factory _$AdminLoginDto([void Function(AdminLoginDtoBuilder)? updates]) =>
      (AdminLoginDtoBuilder()..update(updates))._build();

  _$AdminLoginDto._({required this.username, required this.password})
    : super._();
  @override
  AdminLoginDto rebuild(void Function(AdminLoginDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  AdminLoginDtoBuilder toBuilder() => AdminLoginDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminLoginDto &&
        username == other.username &&
        password == other.password;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, username.hashCode);
    _$hash = $jc(_$hash, password.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AdminLoginDto')
          ..add('username', username)
          ..add('password', password))
        .toString();
  }
}

class AdminLoginDtoBuilder
    implements Builder<AdminLoginDto, AdminLoginDtoBuilder> {
  _$AdminLoginDto? _$v;

  String? _username;
  String? get username => _$this._username;
  set username(String? username) => _$this._username = username;

  String? _password;
  String? get password => _$this._password;
  set password(String? password) => _$this._password = password;

  AdminLoginDtoBuilder() {
    AdminLoginDto._defaults(this);
  }

  AdminLoginDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _username = $v.username;
      _password = $v.password;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminLoginDto other) {
    _$v = other as _$AdminLoginDto;
  }

  @override
  void update(void Function(AdminLoginDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AdminLoginDto build() => _build();

  _$AdminLoginDto _build() {
    final _$result =
        _$v ??
        _$AdminLoginDto._(
          username: BuiltValueNullFieldError.checkNotNull(
            username,
            r'AdminLoginDto',
            'username',
          ),
          password: BuiltValueNullFieldError.checkNotNull(
            password,
            r'AdminLoginDto',
            'password',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
