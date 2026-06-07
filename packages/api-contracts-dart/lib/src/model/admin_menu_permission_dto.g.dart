// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_menu_permission_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const AdminMenuPermissionDtoTypeEnum
_$adminMenuPermissionDtoTypeEnum_DIRECTORY =
    const AdminMenuPermissionDtoTypeEnum._('DIRECTORY');
const AdminMenuPermissionDtoTypeEnum _$adminMenuPermissionDtoTypeEnum_MENU =
    const AdminMenuPermissionDtoTypeEnum._('MENU');
const AdminMenuPermissionDtoTypeEnum _$adminMenuPermissionDtoTypeEnum_FEATURE =
    const AdminMenuPermissionDtoTypeEnum._('FEATURE');

AdminMenuPermissionDtoTypeEnum _$adminMenuPermissionDtoTypeEnumValueOf(
  String name,
) {
  switch (name) {
    case 'DIRECTORY':
      return _$adminMenuPermissionDtoTypeEnum_DIRECTORY;
    case 'MENU':
      return _$adminMenuPermissionDtoTypeEnum_MENU;
    case 'FEATURE':
      return _$adminMenuPermissionDtoTypeEnum_FEATURE;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<AdminMenuPermissionDtoTypeEnum>
_$adminMenuPermissionDtoTypeEnumValues =
    BuiltSet<AdminMenuPermissionDtoTypeEnum>(
      const <AdminMenuPermissionDtoTypeEnum>[
        _$adminMenuPermissionDtoTypeEnum_DIRECTORY,
        _$adminMenuPermissionDtoTypeEnum_MENU,
        _$adminMenuPermissionDtoTypeEnum_FEATURE,
      ],
    );

Serializer<AdminMenuPermissionDtoTypeEnum>
_$adminMenuPermissionDtoTypeEnumSerializer =
    _$AdminMenuPermissionDtoTypeEnumSerializer();

class _$AdminMenuPermissionDtoTypeEnumSerializer
    implements PrimitiveSerializer<AdminMenuPermissionDtoTypeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'DIRECTORY': 'DIRECTORY',
    'MENU': 'MENU',
    'FEATURE': 'FEATURE',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'DIRECTORY': 'DIRECTORY',
    'MENU': 'MENU',
    'FEATURE': 'FEATURE',
  };

  @override
  final Iterable<Type> types = const <Type>[AdminMenuPermissionDtoTypeEnum];
  @override
  final String wireName = 'AdminMenuPermissionDtoTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    AdminMenuPermissionDtoTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  AdminMenuPermissionDtoTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => AdminMenuPermissionDtoTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$AdminMenuPermissionDto extends AdminMenuPermissionDto {
  @override
  final String id;
  @override
  final String? parentId;
  @override
  final String name;
  @override
  final String? route;
  @override
  final String? icon;
  @override
  final num sortOrder;
  @override
  final String? code;
  @override
  final AdminMenuPermissionDtoTypeEnum type;
  @override
  final BuiltList<AdminMenuPermissionDto>? children;

  factory _$AdminMenuPermissionDto([
    void Function(AdminMenuPermissionDtoBuilder)? updates,
  ]) => (AdminMenuPermissionDtoBuilder()..update(updates))._build();

  _$AdminMenuPermissionDto._({
    required this.id,
    this.parentId,
    required this.name,
    this.route,
    this.icon,
    required this.sortOrder,
    this.code,
    required this.type,
    this.children,
  }) : super._();
  @override
  AdminMenuPermissionDto rebuild(
    void Function(AdminMenuPermissionDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminMenuPermissionDtoBuilder toBuilder() =>
      AdminMenuPermissionDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminMenuPermissionDto &&
        id == other.id &&
        parentId == other.parentId &&
        name == other.name &&
        route == other.route &&
        icon == other.icon &&
        sortOrder == other.sortOrder &&
        code == other.code &&
        type == other.type &&
        children == other.children;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, parentId.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, route.hashCode);
    _$hash = $jc(_$hash, icon.hashCode);
    _$hash = $jc(_$hash, sortOrder.hashCode);
    _$hash = $jc(_$hash, code.hashCode);
    _$hash = $jc(_$hash, type.hashCode);
    _$hash = $jc(_$hash, children.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AdminMenuPermissionDto')
          ..add('id', id)
          ..add('parentId', parentId)
          ..add('name', name)
          ..add('route', route)
          ..add('icon', icon)
          ..add('sortOrder', sortOrder)
          ..add('code', code)
          ..add('type', type)
          ..add('children', children))
        .toString();
  }
}

class AdminMenuPermissionDtoBuilder
    implements Builder<AdminMenuPermissionDto, AdminMenuPermissionDtoBuilder> {
  _$AdminMenuPermissionDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _parentId;
  String? get parentId => _$this._parentId;
  set parentId(String? parentId) => _$this._parentId = parentId;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  String? _route;
  String? get route => _$this._route;
  set route(String? route) => _$this._route = route;

  String? _icon;
  String? get icon => _$this._icon;
  set icon(String? icon) => _$this._icon = icon;

  num? _sortOrder;
  num? get sortOrder => _$this._sortOrder;
  set sortOrder(num? sortOrder) => _$this._sortOrder = sortOrder;

  String? _code;
  String? get code => _$this._code;
  set code(String? code) => _$this._code = code;

  AdminMenuPermissionDtoTypeEnum? _type;
  AdminMenuPermissionDtoTypeEnum? get type => _$this._type;
  set type(AdminMenuPermissionDtoTypeEnum? type) => _$this._type = type;

  ListBuilder<AdminMenuPermissionDto>? _children;
  ListBuilder<AdminMenuPermissionDto> get children =>
      _$this._children ??= ListBuilder<AdminMenuPermissionDto>();
  set children(ListBuilder<AdminMenuPermissionDto>? children) =>
      _$this._children = children;

  AdminMenuPermissionDtoBuilder() {
    AdminMenuPermissionDto._defaults(this);
  }

  AdminMenuPermissionDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _parentId = $v.parentId;
      _name = $v.name;
      _route = $v.route;
      _icon = $v.icon;
      _sortOrder = $v.sortOrder;
      _code = $v.code;
      _type = $v.type;
      _children = $v.children?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminMenuPermissionDto other) {
    _$v = other as _$AdminMenuPermissionDto;
  }

  @override
  void update(void Function(AdminMenuPermissionDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AdminMenuPermissionDto build() => _build();

  _$AdminMenuPermissionDto _build() {
    _$AdminMenuPermissionDto _$result;
    try {
      _$result =
          _$v ??
          _$AdminMenuPermissionDto._(
            id: BuiltValueNullFieldError.checkNotNull(
              id,
              r'AdminMenuPermissionDto',
              'id',
            ),
            parentId: parentId,
            name: BuiltValueNullFieldError.checkNotNull(
              name,
              r'AdminMenuPermissionDto',
              'name',
            ),
            route: route,
            icon: icon,
            sortOrder: BuiltValueNullFieldError.checkNotNull(
              sortOrder,
              r'AdminMenuPermissionDto',
              'sortOrder',
            ),
            code: code,
            type: BuiltValueNullFieldError.checkNotNull(
              type,
              r'AdminMenuPermissionDto',
              'type',
            ),
            children: _children?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'children';
        _children?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AdminMenuPermissionDto',
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
