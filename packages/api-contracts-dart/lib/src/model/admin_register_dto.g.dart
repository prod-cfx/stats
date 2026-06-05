// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_register_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminRegisterDto extends AdminRegisterDto {
  @override
  final String username;
  @override
  final String password;
  @override
  final String? email;
  @override
  final String? nickName;
  @override
  final BuiltList<String>? roleCodes;

  factory _$AdminRegisterDto([
    void Function(AdminRegisterDtoBuilder)? updates,
  ]) => (AdminRegisterDtoBuilder()..update(updates))._build();

  _$AdminRegisterDto._({
    required this.username,
    required this.password,
    this.email,
    this.nickName,
    this.roleCodes,
  }) : super._();
  @override
  AdminRegisterDto rebuild(void Function(AdminRegisterDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  AdminRegisterDtoBuilder toBuilder() =>
      AdminRegisterDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminRegisterDto &&
        username == other.username &&
        password == other.password &&
        email == other.email &&
        nickName == other.nickName &&
        roleCodes == other.roleCodes;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, username.hashCode);
    _$hash = $jc(_$hash, password.hashCode);
    _$hash = $jc(_$hash, email.hashCode);
    _$hash = $jc(_$hash, nickName.hashCode);
    _$hash = $jc(_$hash, roleCodes.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AdminRegisterDto')
          ..add('username', username)
          ..add('password', password)
          ..add('email', email)
          ..add('nickName', nickName)
          ..add('roleCodes', roleCodes))
        .toString();
  }
}

class AdminRegisterDtoBuilder
    implements Builder<AdminRegisterDto, AdminRegisterDtoBuilder> {
  _$AdminRegisterDto? _$v;

  String? _username;
  String? get username => _$this._username;
  set username(String? username) => _$this._username = username;

  String? _password;
  String? get password => _$this._password;
  set password(String? password) => _$this._password = password;

  String? _email;
  String? get email => _$this._email;
  set email(String? email) => _$this._email = email;

  String? _nickName;
  String? get nickName => _$this._nickName;
  set nickName(String? nickName) => _$this._nickName = nickName;

  ListBuilder<String>? _roleCodes;
  ListBuilder<String> get roleCodes =>
      _$this._roleCodes ??= ListBuilder<String>();
  set roleCodes(ListBuilder<String>? roleCodes) =>
      _$this._roleCodes = roleCodes;

  AdminRegisterDtoBuilder() {
    AdminRegisterDto._defaults(this);
  }

  AdminRegisterDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _username = $v.username;
      _password = $v.password;
      _email = $v.email;
      _nickName = $v.nickName;
      _roleCodes = $v.roleCodes?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminRegisterDto other) {
    _$v = other as _$AdminRegisterDto;
  }

  @override
  void update(void Function(AdminRegisterDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AdminRegisterDto build() => _build();

  _$AdminRegisterDto _build() {
    _$AdminRegisterDto _$result;
    try {
      _$result =
          _$v ??
          _$AdminRegisterDto._(
            username: BuiltValueNullFieldError.checkNotNull(
              username,
              r'AdminRegisterDto',
              'username',
            ),
            password: BuiltValueNullFieldError.checkNotNull(
              password,
              r'AdminRegisterDto',
              'password',
            ),
            email: email,
            nickName: nickName,
            roleCodes: _roleCodes?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'roleCodes';
        _roleCodes?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AdminRegisterDto',
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
