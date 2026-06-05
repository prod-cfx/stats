// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_role_controller_list0200_response_all_of_items_inner.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminRoleControllerList0200ResponseAllOfItemsInner
    extends AdminRoleControllerList0200ResponseAllOfItemsInner {
  @override
  final String? id;
  @override
  final String? code;
  @override
  final String? name;
  @override
  final String? description;
  @override
  final BuiltList<String>? menuPermissions;
  @override
  final BuiltList<String>? featurePermissions;
  @override
  final BuiltList<String>? apiPermissions;
  @override
  final DateTime? createdAt;
  @override
  final DateTime? updatedAt;

  factory _$AdminRoleControllerList0200ResponseAllOfItemsInner([
    void Function(AdminRoleControllerList0200ResponseAllOfItemsInnerBuilder)?
    updates,
  ]) =>
      (AdminRoleControllerList0200ResponseAllOfItemsInnerBuilder()
            ..update(updates))
          ._build();

  _$AdminRoleControllerList0200ResponseAllOfItemsInner._({
    this.id,
    this.code,
    this.name,
    this.description,
    this.menuPermissions,
    this.featurePermissions,
    this.apiPermissions,
    this.createdAt,
    this.updatedAt,
  }) : super._();
  @override
  AdminRoleControllerList0200ResponseAllOfItemsInner rebuild(
    void Function(AdminRoleControllerList0200ResponseAllOfItemsInnerBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminRoleControllerList0200ResponseAllOfItemsInnerBuilder toBuilder() =>
      AdminRoleControllerList0200ResponseAllOfItemsInnerBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminRoleControllerList0200ResponseAllOfItemsInner &&
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
    return (newBuiltValueToStringHelper(
            r'AdminRoleControllerList0200ResponseAllOfItemsInner',
          )
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

class AdminRoleControllerList0200ResponseAllOfItemsInnerBuilder
    implements
        Builder<
          AdminRoleControllerList0200ResponseAllOfItemsInner,
          AdminRoleControllerList0200ResponseAllOfItemsInnerBuilder
        > {
  _$AdminRoleControllerList0200ResponseAllOfItemsInner? _$v;

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

  AdminRoleControllerList0200ResponseAllOfItemsInnerBuilder() {
    AdminRoleControllerList0200ResponseAllOfItemsInner._defaults(this);
  }

  AdminRoleControllerList0200ResponseAllOfItemsInnerBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _code = $v.code;
      _name = $v.name;
      _description = $v.description;
      _menuPermissions = $v.menuPermissions?.toBuilder();
      _featurePermissions = $v.featurePermissions?.toBuilder();
      _apiPermissions = $v.apiPermissions?.toBuilder();
      _createdAt = $v.createdAt;
      _updatedAt = $v.updatedAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminRoleControllerList0200ResponseAllOfItemsInner other) {
    _$v = other as _$AdminRoleControllerList0200ResponseAllOfItemsInner;
  }

  @override
  void update(
    void Function(AdminRoleControllerList0200ResponseAllOfItemsInnerBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AdminRoleControllerList0200ResponseAllOfItemsInner build() => _build();

  _$AdminRoleControllerList0200ResponseAllOfItemsInner _build() {
    _$AdminRoleControllerList0200ResponseAllOfItemsInner _$result;
    try {
      _$result =
          _$v ??
          _$AdminRoleControllerList0200ResponseAllOfItemsInner._(
            id: id,
            code: code,
            name: name,
            description: description,
            menuPermissions: _menuPermissions?.build(),
            featurePermissions: _featurePermissions?.build(),
            apiPermissions: _apiPermissions?.build(),
            createdAt: createdAt,
            updatedAt: updatedAt,
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
          r'AdminRoleControllerList0200ResponseAllOfItemsInner',
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
