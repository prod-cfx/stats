// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_assigned_role_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminAssignedRoleDto extends AdminAssignedRoleDto {
  @override
  final String id;
  @override
  final String code;
  @override
  final String name;
  @override
  final String? description;

  factory _$AdminAssignedRoleDto([
    void Function(AdminAssignedRoleDtoBuilder)? updates,
  ]) => (AdminAssignedRoleDtoBuilder()..update(updates))._build();

  _$AdminAssignedRoleDto._({
    required this.id,
    required this.code,
    required this.name,
    this.description,
  }) : super._();
  @override
  AdminAssignedRoleDto rebuild(
    void Function(AdminAssignedRoleDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminAssignedRoleDtoBuilder toBuilder() =>
      AdminAssignedRoleDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminAssignedRoleDto &&
        id == other.id &&
        code == other.code &&
        name == other.name &&
        description == other.description;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, code.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, description.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AdminAssignedRoleDto')
          ..add('id', id)
          ..add('code', code)
          ..add('name', name)
          ..add('description', description))
        .toString();
  }
}

class AdminAssignedRoleDtoBuilder
    implements Builder<AdminAssignedRoleDto, AdminAssignedRoleDtoBuilder> {
  _$AdminAssignedRoleDto? _$v;

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

  AdminAssignedRoleDtoBuilder() {
    AdminAssignedRoleDto._defaults(this);
  }

  AdminAssignedRoleDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _code = $v.code;
      _name = $v.name;
      _description = $v.description;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminAssignedRoleDto other) {
    _$v = other as _$AdminAssignedRoleDto;
  }

  @override
  void update(void Function(AdminAssignedRoleDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AdminAssignedRoleDto build() => _build();

  _$AdminAssignedRoleDto _build() {
    final _$result =
        _$v ??
        _$AdminAssignedRoleDto._(
          id: BuiltValueNullFieldError.checkNotNull(
            id,
            r'AdminAssignedRoleDto',
            'id',
          ),
          code: BuiltValueNullFieldError.checkNotNull(
            code,
            r'AdminAssignedRoleDto',
            'code',
          ),
          name: BuiltValueNullFieldError.checkNotNull(
            name,
            r'AdminAssignedRoleDto',
            'name',
          ),
          description: description,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
