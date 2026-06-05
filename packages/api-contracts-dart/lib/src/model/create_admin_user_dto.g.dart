// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_admin_user_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$CreateAdminUserDto extends CreateAdminUserDto {
  @override
  final String username;
  @override
  final String password;
  @override
  final String? nickName;
  @override
  final String? email;
  @override
  final String? avatarUrl;
  @override
  final String? phone;
  @override
  final BuiltList<String>? roleIds;

  factory _$CreateAdminUserDto([
    void Function(CreateAdminUserDtoBuilder)? updates,
  ]) => (CreateAdminUserDtoBuilder()..update(updates))._build();

  _$CreateAdminUserDto._({
    required this.username,
    required this.password,
    this.nickName,
    this.email,
    this.avatarUrl,
    this.phone,
    this.roleIds,
  }) : super._();
  @override
  CreateAdminUserDto rebuild(
    void Function(CreateAdminUserDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  CreateAdminUserDtoBuilder toBuilder() =>
      CreateAdminUserDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CreateAdminUserDto &&
        username == other.username &&
        password == other.password &&
        nickName == other.nickName &&
        email == other.email &&
        avatarUrl == other.avatarUrl &&
        phone == other.phone &&
        roleIds == other.roleIds;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, username.hashCode);
    _$hash = $jc(_$hash, password.hashCode);
    _$hash = $jc(_$hash, nickName.hashCode);
    _$hash = $jc(_$hash, email.hashCode);
    _$hash = $jc(_$hash, avatarUrl.hashCode);
    _$hash = $jc(_$hash, phone.hashCode);
    _$hash = $jc(_$hash, roleIds.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'CreateAdminUserDto')
          ..add('username', username)
          ..add('password', password)
          ..add('nickName', nickName)
          ..add('email', email)
          ..add('avatarUrl', avatarUrl)
          ..add('phone', phone)
          ..add('roleIds', roleIds))
        .toString();
  }
}

class CreateAdminUserDtoBuilder
    implements Builder<CreateAdminUserDto, CreateAdminUserDtoBuilder> {
  _$CreateAdminUserDto? _$v;

  String? _username;
  String? get username => _$this._username;
  set username(String? username) => _$this._username = username;

  String? _password;
  String? get password => _$this._password;
  set password(String? password) => _$this._password = password;

  String? _nickName;
  String? get nickName => _$this._nickName;
  set nickName(String? nickName) => _$this._nickName = nickName;

  String? _email;
  String? get email => _$this._email;
  set email(String? email) => _$this._email = email;

  String? _avatarUrl;
  String? get avatarUrl => _$this._avatarUrl;
  set avatarUrl(String? avatarUrl) => _$this._avatarUrl = avatarUrl;

  String? _phone;
  String? get phone => _$this._phone;
  set phone(String? phone) => _$this._phone = phone;

  ListBuilder<String>? _roleIds;
  ListBuilder<String> get roleIds => _$this._roleIds ??= ListBuilder<String>();
  set roleIds(ListBuilder<String>? roleIds) => _$this._roleIds = roleIds;

  CreateAdminUserDtoBuilder() {
    CreateAdminUserDto._defaults(this);
  }

  CreateAdminUserDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _username = $v.username;
      _password = $v.password;
      _nickName = $v.nickName;
      _email = $v.email;
      _avatarUrl = $v.avatarUrl;
      _phone = $v.phone;
      _roleIds = $v.roleIds?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CreateAdminUserDto other) {
    _$v = other as _$CreateAdminUserDto;
  }

  @override
  void update(void Function(CreateAdminUserDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  CreateAdminUserDto build() => _build();

  _$CreateAdminUserDto _build() {
    _$CreateAdminUserDto _$result;
    try {
      _$result =
          _$v ??
          _$CreateAdminUserDto._(
            username: BuiltValueNullFieldError.checkNotNull(
              username,
              r'CreateAdminUserDto',
              'username',
            ),
            password: BuiltValueNullFieldError.checkNotNull(
              password,
              r'CreateAdminUserDto',
              'password',
            ),
            nickName: nickName,
            email: email,
            avatarUrl: avatarUrl,
            phone: phone,
            roleIds: _roleIds?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'roleIds';
        _roleIds?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'CreateAdminUserDto',
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
