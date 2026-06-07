// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_role_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminRoleResponseDto extends AdminRoleResponseDto {
  @override
  final String id;
  @override
  final String code;
  @override
  final String name;
  @override
  final String? description;
  @override
  final BuiltList<String> menuPermissions;
  @override
  final BuiltList<String> featurePermissions;
  @override
  final BuiltList<String> apiPermissions;
  @override
  final DateTime createdAt;
  @override
  final DateTime updatedAt;

  factory _$AdminRoleResponseDto([
    void Function(AdminRoleResponseDtoBuilder)? updates,
  ]) => (AdminRoleResponseDtoBuilder()..update(updates))._build();

  _$AdminRoleResponseDto._({
    required this.id,
    required this.code,
    required this.name,
    this.description,
    required this.menuPermissions,
    required this.featurePermissions,
    required this.apiPermissions,
    required this.createdAt,
    required this.updatedAt,
  }) : super._();
  @override
  AdminRoleResponseDto rebuild(
    void Function(AdminRoleResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminRoleResponseDtoBuilder toBuilder() =>
      AdminRoleResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminRoleResponseDto &&
        id == other.id &&
        code == other.code &&
        name == other.name &&
        description == other.description &&
        menuPermissions == other.menuPermissions &&
        featurePermissions == other.featurePermissions &&
        apiPermissions == other.apiPermissions &&
        createdAt == other.createdAt &&
        updatedAt == other.updatedAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, code.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, description.hashCode);
    _$hash = $jc(_$hash, menuPermissions.hashCode);
    _$hash = $jc(_$hash, featurePermissions.hashCode);
    _$hash = $jc(_$hash, apiPermissions.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jc(_$hash, updatedAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AdminRoleResponseDto')
          ..add('id', id)
          ..add('code', code)
          ..add('name', name)
          ..add('description', description)
          ..add('menuPermissions', menuPermissions)
          ..add('featurePermissions', featurePermissions)
          ..add('apiPermissions', apiPermissions)
          ..add('createdAt', createdAt)
          ..add('updatedAt', updatedAt))
        .toString();
  }
}

class AdminRoleResponseDtoBuilder
    implements Builder<AdminRoleResponseDto, AdminRoleResponseDtoBuilder> {
  _$AdminRoleResponseDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

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

  DateTime? _createdAt;
  DateTime? get createdAt => _$this._createdAt;
  set createdAt(DateTime? createdAt) => _$this._createdAt = createdAt;

  DateTime? _updatedAt;
  DateTime? get updatedAt => _$this._updatedAt;
  set updatedAt(DateTime? updatedAt) => _$this._updatedAt = updatedAt;

  AdminRoleResponseDtoBuilder() {
    AdminRoleResponseDto._defaults(this);
  }

  AdminRoleResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _code = $v.code;
      _name = $v.name;
      _description = $v.description;
      _menuPermissions = $v.menuPermissions.toBuilder();
      _featurePermissions = $v.featurePermissions.toBuilder();
      _apiPermissions = $v.apiPermissions.toBuilder();
      _createdAt = $v.createdAt;
      _updatedAt = $v.updatedAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminRoleResponseDto other) {
    _$v = other as _$AdminRoleResponseDto;
  }

  @override
  void update(void Function(AdminRoleResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AdminRoleResponseDto build() => _build();

  _$AdminRoleResponseDto _build() {
    _$AdminRoleResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$AdminRoleResponseDto._(
            id: BuiltValueNullFieldError.checkNotNull(
              id,
              r'AdminRoleResponseDto',
              'id',
            ),
            code: BuiltValueNullFieldError.checkNotNull(
              code,
              r'AdminRoleResponseDto',
              'code',
            ),
            name: BuiltValueNullFieldError.checkNotNull(
              name,
              r'AdminRoleResponseDto',
              'name',
            ),
            description: description,
            menuPermissions: menuPermissions.build(),
            featurePermissions: featurePermissions.build(),
            apiPermissions: apiPermissions.build(),
            createdAt: BuiltValueNullFieldError.checkNotNull(
              createdAt,
              r'AdminRoleResponseDto',
              'createdAt',
            ),
            updatedAt: BuiltValueNullFieldError.checkNotNull(
              updatedAt,
              r'AdminRoleResponseDto',
              'updatedAt',
            ),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'menuPermissions';
        menuPermissions.build();
        _$failedField = 'featurePermissions';
        featurePermissions.build();
        _$failedField = 'apiPermissions';
        apiPermissions.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AdminRoleResponseDto',
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
