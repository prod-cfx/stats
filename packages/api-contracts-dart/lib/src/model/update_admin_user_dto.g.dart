// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_admin_user_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$UpdateAdminUserDto extends UpdateAdminUserDto {
  @override
  final String? nickName;
  @override
  final String? email;
  @override
  final String? avatarUrl;
  @override
  final String? phone;
  @override
  final bool? isFrozen;
  @override
  final BuiltList<String>? roleIds;

  factory _$UpdateAdminUserDto([
    void Function(UpdateAdminUserDtoBuilder)? updates,
  ]) => (UpdateAdminUserDtoBuilder()..update(updates))._build();

  _$UpdateAdminUserDto._({
    this.nickName,
    this.email,
    this.avatarUrl,
    this.phone,
    this.isFrozen,
    this.roleIds,
  }) : super._();
  @override
  UpdateAdminUserDto rebuild(
    void Function(UpdateAdminUserDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  UpdateAdminUserDtoBuilder toBuilder() =>
      UpdateAdminUserDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is UpdateAdminUserDto &&
        nickName == other.nickName &&
        email == other.email &&
        avatarUrl == other.avatarUrl &&
        phone == other.phone &&
        isFrozen == other.isFrozen &&
        roleIds == other.roleIds;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, nickName.hashCode);
    _$hash = $jc(_$hash, email.hashCode);
    _$hash = $jc(_$hash, avatarUrl.hashCode);
    _$hash = $jc(_$hash, phone.hashCode);
    _$hash = $jc(_$hash, isFrozen.hashCode);
    _$hash = $jc(_$hash, roleIds.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'UpdateAdminUserDto')
          ..add('nickName', nickName)
          ..add('email', email)
          ..add('avatarUrl', avatarUrl)
          ..add('phone', phone)
          ..add('isFrozen', isFrozen)
          ..add('roleIds', roleIds))
        .toString();
  }
}

class UpdateAdminUserDtoBuilder
    implements Builder<UpdateAdminUserDto, UpdateAdminUserDtoBuilder> {
  _$UpdateAdminUserDto? _$v;

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

  ListBuilder<String>? _roleIds;
  ListBuilder<String> get roleIds => _$this._roleIds ??= ListBuilder<String>();
  set roleIds(ListBuilder<String>? roleIds) => _$this._roleIds = roleIds;

  UpdateAdminUserDtoBuilder() {
    UpdateAdminUserDto._defaults(this);
  }

  UpdateAdminUserDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _nickName = $v.nickName;
      _email = $v.email;
      _avatarUrl = $v.avatarUrl;
      _phone = $v.phone;
      _isFrozen = $v.isFrozen;
      _roleIds = $v.roleIds?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(UpdateAdminUserDto other) {
    _$v = other as _$UpdateAdminUserDto;
  }

  @override
  void update(void Function(UpdateAdminUserDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  UpdateAdminUserDto build() => _build();

  _$UpdateAdminUserDto _build() {
    _$UpdateAdminUserDto _$result;
    try {
      _$result =
          _$v ??
          _$UpdateAdminUserDto._(
            nickName: nickName,
            email: email,
            avatarUrl: avatarUrl,
            phone: phone,
            isFrozen: isFrozen,
            roleIds: _roleIds?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'roleIds';
        _roleIds?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'UpdateAdminUserDto',
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
