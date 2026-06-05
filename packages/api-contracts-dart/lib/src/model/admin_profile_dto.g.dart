// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_profile_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminProfileDto extends AdminProfileDto {
  @override
  final String id;
  @override
  final String username;
  @override
  final String? email;
  @override
  final String? nickName;
  @override
  final bool isFrozen;
  @override
  final BuiltList<String> menuPermissions;

  factory _$AdminProfileDto([void Function(AdminProfileDtoBuilder)? updates]) =>
      (AdminProfileDtoBuilder()..update(updates))._build();

  _$AdminProfileDto._({
    required this.id,
    required this.username,
    this.email,
    this.nickName,
    required this.isFrozen,
    required this.menuPermissions,
  }) : super._();
  @override
  AdminProfileDto rebuild(void Function(AdminProfileDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  AdminProfileDtoBuilder toBuilder() => AdminProfileDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminProfileDto &&
        id == other.id &&
        username == other.username &&
        email == other.email &&
        nickName == other.nickName &&
        isFrozen == other.isFrozen &&
        menuPermissions == other.menuPermissions;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, username.hashCode);
    _$hash = $jc(_$hash, email.hashCode);
    _$hash = $jc(_$hash, nickName.hashCode);
    _$hash = $jc(_$hash, isFrozen.hashCode);
    _$hash = $jc(_$hash, menuPermissions.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AdminProfileDto')
          ..add('id', id)
          ..add('username', username)
          ..add('email', email)
          ..add('nickName', nickName)
          ..add('isFrozen', isFrozen)
          ..add('menuPermissions', menuPermissions))
        .toString();
  }
}

class AdminProfileDtoBuilder
    implements Builder<AdminProfileDto, AdminProfileDtoBuilder> {
  _$AdminProfileDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _username;
  String? get username => _$this._username;
  set username(String? username) => _$this._username = username;

  String? _email;
  String? get email => _$this._email;
  set email(String? email) => _$this._email = email;

  String? _nickName;
  String? get nickName => _$this._nickName;
  set nickName(String? nickName) => _$this._nickName = nickName;

  bool? _isFrozen;
  bool? get isFrozen => _$this._isFrozen;
  set isFrozen(bool? isFrozen) => _$this._isFrozen = isFrozen;

  ListBuilder<String>? _menuPermissions;
  ListBuilder<String> get menuPermissions =>
      _$this._menuPermissions ??= ListBuilder<String>();
  set menuPermissions(ListBuilder<String>? menuPermissions) =>
      _$this._menuPermissions = menuPermissions;

  AdminProfileDtoBuilder() {
    AdminProfileDto._defaults(this);
  }

  AdminProfileDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _username = $v.username;
      _email = $v.email;
      _nickName = $v.nickName;
      _isFrozen = $v.isFrozen;
      _menuPermissions = $v.menuPermissions.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminProfileDto other) {
    _$v = other as _$AdminProfileDto;
  }

  @override
  void update(void Function(AdminProfileDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AdminProfileDto build() => _build();

  _$AdminProfileDto _build() {
    _$AdminProfileDto _$result;
    try {
      _$result =
          _$v ??
          _$AdminProfileDto._(
            id: BuiltValueNullFieldError.checkNotNull(
              id,
              r'AdminProfileDto',
              'id',
            ),
            username: BuiltValueNullFieldError.checkNotNull(
              username,
              r'AdminProfileDto',
              'username',
            ),
            email: email,
            nickName: nickName,
            isFrozen: BuiltValueNullFieldError.checkNotNull(
              isFrozen,
              r'AdminProfileDto',
              'isFrozen',
            ),
            menuPermissions: menuPermissions.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'menuPermissions';
        menuPermissions.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AdminProfileDto',
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
