// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_user_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminUserDto extends AdminUserDto {
  @override
  final String id;
  @override
  final String username;
  @override
  final String? nickName;
  @override
  final String? email;
  @override
  final String? avatarUrl;
  @override
  final String? phone;
  @override
  final bool isFrozen;
  @override
  final BuiltList<AdminAssignedRoleDto> roles;

  factory _$AdminUserDto([void Function(AdminUserDtoBuilder)? updates]) =>
      (AdminUserDtoBuilder()..update(updates))._build();

  _$AdminUserDto._({
    required this.id,
    required this.username,
    this.nickName,
    this.email,
    this.avatarUrl,
    this.phone,
    required this.isFrozen,
    required this.roles,
  }) : super._();
  @override
  AdminUserDto rebuild(void Function(AdminUserDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  AdminUserDtoBuilder toBuilder() => AdminUserDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminUserDto &&
        id == other.id &&
        username == other.username &&
        nickName == other.nickName &&
        email == other.email &&
        avatarUrl == other.avatarUrl &&
        phone == other.phone &&
        isFrozen == other.isFrozen &&
        roles == other.roles;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, username.hashCode);
    _$hash = $jc(_$hash, nickName.hashCode);
    _$hash = $jc(_$hash, email.hashCode);
    _$hash = $jc(_$hash, avatarUrl.hashCode);
    _$hash = $jc(_$hash, phone.hashCode);
    _$hash = $jc(_$hash, isFrozen.hashCode);
    _$hash = $jc(_$hash, roles.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AdminUserDto')
          ..add('id', id)
          ..add('username', username)
          ..add('nickName', nickName)
          ..add('email', email)
          ..add('avatarUrl', avatarUrl)
          ..add('phone', phone)
          ..add('isFrozen', isFrozen)
          ..add('roles', roles))
        .toString();
  }
}

class AdminUserDtoBuilder
    implements Builder<AdminUserDto, AdminUserDtoBuilder> {
  _$AdminUserDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _username;
  String? get username => _$this._username;
  set username(String? username) => _$this._username = username;

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

  bool? _isFrozen;
  bool? get isFrozen => _$this._isFrozen;
  set isFrozen(bool? isFrozen) => _$this._isFrozen = isFrozen;

  ListBuilder<AdminAssignedRoleDto>? _roles;
  ListBuilder<AdminAssignedRoleDto> get roles =>
      _$this._roles ??= ListBuilder<AdminAssignedRoleDto>();
  set roles(ListBuilder<AdminAssignedRoleDto>? roles) => _$this._roles = roles;

  AdminUserDtoBuilder() {
    AdminUserDto._defaults(this);
  }

  AdminUserDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _username = $v.username;
      _nickName = $v.nickName;
      _email = $v.email;
      _avatarUrl = $v.avatarUrl;
      _phone = $v.phone;
      _isFrozen = $v.isFrozen;
      _roles = $v.roles.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminUserDto other) {
    _$v = other as _$AdminUserDto;
  }

  @override
  void update(void Function(AdminUserDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AdminUserDto build() => _build();

  _$AdminUserDto _build() {
    _$AdminUserDto _$result;
    try {
      _$result =
          _$v ??
          _$AdminUserDto._(
            id: BuiltValueNullFieldError.checkNotNull(
              id,
              r'AdminUserDto',
              'id',
            ),
            username: BuiltValueNullFieldError.checkNotNull(
              username,
              r'AdminUserDto',
              'username',
            ),
            nickName: nickName,
            email: email,
            avatarUrl: avatarUrl,
            phone: phone,
            isFrozen: BuiltValueNullFieldError.checkNotNull(
              isFrozen,
              r'AdminUserDto',
              'isFrozen',
            ),
            roles: roles.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'roles';
        roles.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AdminUserDto',
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
