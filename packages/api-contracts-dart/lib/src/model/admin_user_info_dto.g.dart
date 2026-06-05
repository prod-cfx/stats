// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_user_info_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminUserInfoDto extends AdminUserInfoDto {
  @override
  final String id;
  @override
  final String username;
  @override
  final String? nickName;
  @override
  final String? headPic;
  @override
  final BuiltList<AdminMenuPermissionDto> menus;
  @override
  final BuiltList<String> menuPermissions;
  @override
  final BuiltList<String> featurePermissions;
  @override
  final BuiltList<String> apiPermissions;

  factory _$AdminUserInfoDto([
    void Function(AdminUserInfoDtoBuilder)? updates,
  ]) => (AdminUserInfoDtoBuilder()..update(updates))._build();

  _$AdminUserInfoDto._({
    required this.id,
    required this.username,
    this.nickName,
    this.headPic,
    required this.menus,
    required this.menuPermissions,
    required this.featurePermissions,
    required this.apiPermissions,
  }) : super._();
  @override
  AdminUserInfoDto rebuild(void Function(AdminUserInfoDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  AdminUserInfoDtoBuilder toBuilder() =>
      AdminUserInfoDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminUserInfoDto &&
        id == other.id &&
        username == other.username &&
        nickName == other.nickName &&
        headPic == other.headPic &&
        menus == other.menus &&
        menuPermissions == other.menuPermissions &&
        featurePermissions == other.featurePermissions &&
        apiPermissions == other.apiPermissions;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, username.hashCode);
    _$hash = $jc(_$hash, nickName.hashCode);
    _$hash = $jc(_$hash, headPic.hashCode);
    _$hash = $jc(_$hash, menus.hashCode);
    _$hash = $jc(_$hash, menuPermissions.hashCode);
    _$hash = $jc(_$hash, featurePermissions.hashCode);
    _$hash = $jc(_$hash, apiPermissions.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AdminUserInfoDto')
          ..add('id', id)
          ..add('username', username)
          ..add('nickName', nickName)
          ..add('headPic', headPic)
          ..add('menus', menus)
          ..add('menuPermissions', menuPermissions)
          ..add('featurePermissions', featurePermissions)
          ..add('apiPermissions', apiPermissions))
        .toString();
  }
}

class AdminUserInfoDtoBuilder
    implements Builder<AdminUserInfoDto, AdminUserInfoDtoBuilder> {
  _$AdminUserInfoDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _username;
  String? get username => _$this._username;
  set username(String? username) => _$this._username = username;

  String? _nickName;
  String? get nickName => _$this._nickName;
  set nickName(String? nickName) => _$this._nickName = nickName;

  String? _headPic;
  String? get headPic => _$this._headPic;
  set headPic(String? headPic) => _$this._headPic = headPic;

  ListBuilder<AdminMenuPermissionDto>? _menus;
  ListBuilder<AdminMenuPermissionDto> get menus =>
      _$this._menus ??= ListBuilder<AdminMenuPermissionDto>();
  set menus(ListBuilder<AdminMenuPermissionDto>? menus) =>
      _$this._menus = menus;

  ListBuilder<String>? _menuPermissions;
  ListBuilder<String> get menuPermissions =>
      _$this._menuPermissions ??= ListBuilder<String>();
  set menuPermissions(ListBuilder<String>? menuPermissions) =>
      _$this._menuPermissions = menuPermissions;

  ListBuilder<String>? _featurePermissions;
  ListBuilder<String> get featurePermissions =>
      _$this._featurePermissions ??= ListBuilder<String>();
  set featurePermissions(ListBuilder<String>? featurePermissions) =>
      _$this._featurePermissions = featurePermissions;

  ListBuilder<String>? _apiPermissions;
  ListBuilder<String> get apiPermissions =>
      _$this._apiPermissions ??= ListBuilder<String>();
  set apiPermissions(ListBuilder<String>? apiPermissions) =>
      _$this._apiPermissions = apiPermissions;

  AdminUserInfoDtoBuilder() {
    AdminUserInfoDto._defaults(this);
  }

  AdminUserInfoDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _username = $v.username;
      _nickName = $v.nickName;
      _headPic = $v.headPic;
      _menus = $v.menus.toBuilder();
      _menuPermissions = $v.menuPermissions.toBuilder();
      _featurePermissions = $v.featurePermissions.toBuilder();
      _apiPermissions = $v.apiPermissions.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminUserInfoDto other) {
    _$v = other as _$AdminUserInfoDto;
  }

  @override
  void update(void Function(AdminUserInfoDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AdminUserInfoDto build() => _build();

  _$AdminUserInfoDto _build() {
    _$AdminUserInfoDto _$result;
    try {
      _$result =
          _$v ??
          _$AdminUserInfoDto._(
            id: BuiltValueNullFieldError.checkNotNull(
              id,
              r'AdminUserInfoDto',
              'id',
            ),
            username: BuiltValueNullFieldError.checkNotNull(
              username,
              r'AdminUserInfoDto',
              'username',
            ),
            nickName: nickName,
            headPic: headPic,
            menus: menus.build(),
            menuPermissions: menuPermissions.build(),
            featurePermissions: featurePermissions.build(),
            apiPermissions: apiPermissions.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'menus';
        menus.build();
        _$failedField = 'menuPermissions';
        menuPermissions.build();
        _$failedField = 'featurePermissions';
        featurePermissions.build();
        _$failedField = 'apiPermissions';
        apiPermissions.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AdminUserInfoDto',
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
