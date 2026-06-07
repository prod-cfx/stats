// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_menu_tree_node_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const AdminMenuTreeNodeResponseDtoTypeEnum
_$adminMenuTreeNodeResponseDtoTypeEnum_DIRECTORY =
    const AdminMenuTreeNodeResponseDtoTypeEnum._('DIRECTORY');
const AdminMenuTreeNodeResponseDtoTypeEnum
_$adminMenuTreeNodeResponseDtoTypeEnum_MENU =
    const AdminMenuTreeNodeResponseDtoTypeEnum._('MENU');
const AdminMenuTreeNodeResponseDtoTypeEnum
_$adminMenuTreeNodeResponseDtoTypeEnum_FEATURE =
    const AdminMenuTreeNodeResponseDtoTypeEnum._('FEATURE');

AdminMenuTreeNodeResponseDtoTypeEnum
_$adminMenuTreeNodeResponseDtoTypeEnumValueOf(String name) {
  switch (name) {
    case 'DIRECTORY':
      return _$adminMenuTreeNodeResponseDtoTypeEnum_DIRECTORY;
    case 'MENU':
      return _$adminMenuTreeNodeResponseDtoTypeEnum_MENU;
    case 'FEATURE':
      return _$adminMenuTreeNodeResponseDtoTypeEnum_FEATURE;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<AdminMenuTreeNodeResponseDtoTypeEnum>
_$adminMenuTreeNodeResponseDtoTypeEnumValues =
    BuiltSet<AdminMenuTreeNodeResponseDtoTypeEnum>(
      const <AdminMenuTreeNodeResponseDtoTypeEnum>[
        _$adminMenuTreeNodeResponseDtoTypeEnum_DIRECTORY,
        _$adminMenuTreeNodeResponseDtoTypeEnum_MENU,
        _$adminMenuTreeNodeResponseDtoTypeEnum_FEATURE,
      ],
    );

Serializer<AdminMenuTreeNodeResponseDtoTypeEnum>
_$adminMenuTreeNodeResponseDtoTypeEnumSerializer =
    _$AdminMenuTreeNodeResponseDtoTypeEnumSerializer();

class _$AdminMenuTreeNodeResponseDtoTypeEnumSerializer
    implements PrimitiveSerializer<AdminMenuTreeNodeResponseDtoTypeEnum> {
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
  final Iterable<Type> types = const <Type>[
    AdminMenuTreeNodeResponseDtoTypeEnum,
  ];
  @override
  final String wireName = 'AdminMenuTreeNodeResponseDtoTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    AdminMenuTreeNodeResponseDtoTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  AdminMenuTreeNodeResponseDtoTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => AdminMenuTreeNodeResponseDtoTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$AdminMenuTreeNodeResponseDto extends AdminMenuTreeNodeResponseDto {
  @override
  final String id;
  @override
  final String? parentId;
  @override
  final AdminMenuTreeNodeResponseDtoTypeEnum type;
  @override
  final String title;
  @override
  final String? icon;
  @override
  final String? code;
  @override
  final String? path;
  @override
  final String? description;
  @override
  final String? i18nKey;
  @override
  final num sort;
  @override
  final bool isShow;
  @override
  final DateTime createdAt;
  @override
  final DateTime updatedAt;
  @override
  final BuiltList<AdminMenuTreeNodeResponseDto> children;

  factory _$AdminMenuTreeNodeResponseDto([
    void Function(AdminMenuTreeNodeResponseDtoBuilder)? updates,
  ]) => (AdminMenuTreeNodeResponseDtoBuilder()..update(updates))._build();

  _$AdminMenuTreeNodeResponseDto._({
    required this.id,
    this.parentId,
    required this.type,
    required this.title,
    this.icon,
    this.code,
    this.path,
    this.description,
    this.i18nKey,
    required this.sort,
    required this.isShow,
    required this.createdAt,
    required this.updatedAt,
    required this.children,
  }) : super._();
  @override
  AdminMenuTreeNodeResponseDto rebuild(
    void Function(AdminMenuTreeNodeResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminMenuTreeNodeResponseDtoBuilder toBuilder() =>
      AdminMenuTreeNodeResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminMenuTreeNodeResponseDto &&
        id == other.id &&
        parentId == other.parentId &&
        type == other.type &&
        title == other.title &&
        icon == other.icon &&
        code == other.code &&
        path == other.path &&
        description == other.description &&
        i18nKey == other.i18nKey &&
        sort == other.sort &&
        isShow == other.isShow &&
        createdAt == other.createdAt &&
        updatedAt == other.updatedAt &&
        children == other.children;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, parentId.hashCode);
    _$hash = $jc(_$hash, type.hashCode);
    _$hash = $jc(_$hash, title.hashCode);
    _$hash = $jc(_$hash, icon.hashCode);
    _$hash = $jc(_$hash, code.hashCode);
    _$hash = $jc(_$hash, path.hashCode);
    _$hash = $jc(_$hash, description.hashCode);
    _$hash = $jc(_$hash, i18nKey.hashCode);
    _$hash = $jc(_$hash, sort.hashCode);
    _$hash = $jc(_$hash, isShow.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jc(_$hash, updatedAt.hashCode);
    _$hash = $jc(_$hash, children.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AdminMenuTreeNodeResponseDto')
          ..add('id', id)
          ..add('parentId', parentId)
          ..add('type', type)
          ..add('title', title)
          ..add('icon', icon)
          ..add('code', code)
          ..add('path', path)
          ..add('description', description)
          ..add('i18nKey', i18nKey)
          ..add('sort', sort)
          ..add('isShow', isShow)
          ..add('createdAt', createdAt)
          ..add('updatedAt', updatedAt)
          ..add('children', children))
        .toString();
  }
}

class AdminMenuTreeNodeResponseDtoBuilder
    implements
        Builder<
          AdminMenuTreeNodeResponseDto,
          AdminMenuTreeNodeResponseDtoBuilder
        > {
  _$AdminMenuTreeNodeResponseDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _parentId;
  String? get parentId => _$this._parentId;
  set parentId(String? parentId) => _$this._parentId = parentId;

  AdminMenuTreeNodeResponseDtoTypeEnum? _type;
  AdminMenuTreeNodeResponseDtoTypeEnum? get type => _$this._type;
  set type(AdminMenuTreeNodeResponseDtoTypeEnum? type) => _$this._type = type;

  String? _title;
  String? get title => _$this._title;
  set title(String? title) => _$this._title = title;

  String? _icon;
  String? get icon => _$this._icon;
  set icon(String? icon) => _$this._icon = icon;

  String? _code;
  String? get code => _$this._code;
  set code(String? code) => _$this._code = code;

  String? _path;
  String? get path => _$this._path;
  set path(String? path) => _$this._path = path;

  String? _description;
  String? get description => _$this._description;
  set description(String? description) => _$this._description = description;

  String? _i18nKey;
  String? get i18nKey => _$this._i18nKey;
  set i18nKey(String? i18nKey) => _$this._i18nKey = i18nKey;

  num? _sort;
  num? get sort => _$this._sort;
  set sort(num? sort) => _$this._sort = sort;

  bool? _isShow;
  bool? get isShow => _$this._isShow;
  set isShow(bool? isShow) => _$this._isShow = isShow;

  DateTime? _createdAt;
  DateTime? get createdAt => _$this._createdAt;
  set createdAt(DateTime? createdAt) => _$this._createdAt = createdAt;

  DateTime? _updatedAt;
  DateTime? get updatedAt => _$this._updatedAt;
  set updatedAt(DateTime? updatedAt) => _$this._updatedAt = updatedAt;

  ListBuilder<AdminMenuTreeNodeResponseDto>? _children;
  ListBuilder<AdminMenuTreeNodeResponseDto> get children =>
      _$this._children ??= ListBuilder<AdminMenuTreeNodeResponseDto>();
  set children(ListBuilder<AdminMenuTreeNodeResponseDto>? children) =>
      _$this._children = children;

  AdminMenuTreeNodeResponseDtoBuilder() {
    AdminMenuTreeNodeResponseDto._defaults(this);
  }

  AdminMenuTreeNodeResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _parentId = $v.parentId;
      _type = $v.type;
      _title = $v.title;
      _icon = $v.icon;
      _code = $v.code;
      _path = $v.path;
      _description = $v.description;
      _i18nKey = $v.i18nKey;
      _sort = $v.sort;
      _isShow = $v.isShow;
      _createdAt = $v.createdAt;
      _updatedAt = $v.updatedAt;
      _children = $v.children.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminMenuTreeNodeResponseDto other) {
    _$v = other as _$AdminMenuTreeNodeResponseDto;
  }

  @override
  void update(void Function(AdminMenuTreeNodeResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AdminMenuTreeNodeResponseDto build() => _build();

  _$AdminMenuTreeNodeResponseDto _build() {
    _$AdminMenuTreeNodeResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$AdminMenuTreeNodeResponseDto._(
            id: BuiltValueNullFieldError.checkNotNull(
              id,
              r'AdminMenuTreeNodeResponseDto',
              'id',
            ),
            parentId: parentId,
            type: BuiltValueNullFieldError.checkNotNull(
              type,
              r'AdminMenuTreeNodeResponseDto',
              'type',
            ),
            title: BuiltValueNullFieldError.checkNotNull(
              title,
              r'AdminMenuTreeNodeResponseDto',
              'title',
            ),
            icon: icon,
            code: code,
            path: path,
            description: description,
            i18nKey: i18nKey,
            sort: BuiltValueNullFieldError.checkNotNull(
              sort,
              r'AdminMenuTreeNodeResponseDto',
              'sort',
            ),
            isShow: BuiltValueNullFieldError.checkNotNull(
              isShow,
              r'AdminMenuTreeNodeResponseDto',
              'isShow',
            ),
            createdAt: BuiltValueNullFieldError.checkNotNull(
              createdAt,
              r'AdminMenuTreeNodeResponseDto',
              'createdAt',
            ),
            updatedAt: BuiltValueNullFieldError.checkNotNull(
              updatedAt,
              r'AdminMenuTreeNodeResponseDto',
              'updatedAt',
            ),
            children: children.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'children';
        children.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AdminMenuTreeNodeResponseDto',
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
