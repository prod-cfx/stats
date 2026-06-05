// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_admin_role_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$CreateAdminRoleDto extends CreateAdminRoleDto {
  @override
  final String code;
  @override
  final String name;
  @override
  final String? description;
  @override
  final BuiltList<String>? menuPermissions;
  @override
  final BuiltList<String>? featurePermissions;
  @override
  final BuiltList<String>? apiPermissions;

  factory _$CreateAdminRoleDto([
    void Function(CreateAdminRoleDtoBuilder)? updates,
  ]) => (CreateAdminRoleDtoBuilder()..update(updates))._build();

  _$CreateAdminRoleDto._({
    required this.code,
    required this.name,
    this.description,
    this.menuPermissions,
    this.featurePermissions,
    this.apiPermissions,
  }) : super._();
  @override
  CreateAdminRoleDto rebuild(
    void Function(CreateAdminRoleDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  CreateAdminRoleDtoBuilder toBuilder() =>
      CreateAdminRoleDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CreateAdminRoleDto &&
        code == other.code &&
        name == other.name &&
        description == other.description &&
        menuPermissions == other.menuPermissions &&
        featurePermissions == other.featurePermissions &&
        apiPermissions == other.apiPermissions;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, code.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, description.hashCode);
    _$hash = $jc(_$hash, menuPermissions.hashCode);
    _$hash = $jc(_$hash, featurePermissions.hashCode);
    _$hash = $jc(_$hash, apiPermissions.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'CreateAdminRoleDto')
          ..add('code', code)
          ..add('name', name)
          ..add('description', description)
          ..add('menuPermissions', menuPermissions)
          ..add('featurePermissions', featurePermissions)
          ..add('apiPermissions', apiPermissions))
        .toString();
  }
}

class CreateAdminRoleDtoBuilder
    implements Builder<CreateAdminRoleDto, CreateAdminRoleDtoBuilder> {
  _$CreateAdminRoleDto? _$v;

  String? _code;
  String? get code => _$this._code;
  set code(String? code) => _$this._code = code;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  String? _description;
  String? get description => _$this._description;
  set description(String? description) => _$this._description = description;

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

  CreateAdminRoleDtoBuilder() {
    CreateAdminRoleDto._defaults(this);
  }

  CreateAdminRoleDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _code = $v.code;
      _name = $v.name;
      _description = $v.description;
      _menuPermissions = $v.menuPermissions?.toBuilder();
      _featurePermissions = $v.featurePermissions?.toBuilder();
      _apiPermissions = $v.apiPermissions?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CreateAdminRoleDto other) {
    _$v = other as _$CreateAdminRoleDto;
  }

  @override
  void update(void Function(CreateAdminRoleDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  CreateAdminRoleDto build() => _build();

  _$CreateAdminRoleDto _build() {
    _$CreateAdminRoleDto _$result;
    try {
      _$result =
          _$v ??
          _$CreateAdminRoleDto._(
            code: BuiltValueNullFieldError.checkNotNull(
              code,
              r'CreateAdminRoleDto',
              'code',
            ),
            name: BuiltValueNullFieldError.checkNotNull(
              name,
              r'CreateAdminRoleDto',
              'name',
            ),
            description: description,
            menuPermissions: _menuPermissions?.build(),
            featurePermissions: _featurePermissions?.build(),
            apiPermissions: _apiPermissions?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'menuPermissions';
        _menuPermissions?.build();
        _$failedField = 'featurePermissions';
        _featurePermissions?.build();
        _$failedField = 'apiPermissions';
        _apiPermissions?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'CreateAdminRoleDto',
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
