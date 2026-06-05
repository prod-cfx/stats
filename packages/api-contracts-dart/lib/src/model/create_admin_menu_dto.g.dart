// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_admin_menu_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$CreateAdminMenuDto extends CreateAdminMenuDto {
  @override
  final String? parentId;
  @override
  final String type;
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
  final num? sort;
  @override
  final bool? isShow;

  factory _$CreateAdminMenuDto([
    void Function(CreateAdminMenuDtoBuilder)? updates,
  ]) => (CreateAdminMenuDtoBuilder()..update(updates))._build();

  _$CreateAdminMenuDto._({
    this.parentId,
    required this.type,
    required this.title,
    this.icon,
    this.code,
    this.path,
    this.description,
    this.i18nKey,
    this.sort,
    this.isShow,
  }) : super._();
  @override
  CreateAdminMenuDto rebuild(
    void Function(CreateAdminMenuDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  CreateAdminMenuDtoBuilder toBuilder() =>
      CreateAdminMenuDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CreateAdminMenuDto &&
        parentId == other.parentId &&
        type == other.type &&
        title == other.title &&
        icon == other.icon &&
        code == other.code &&
        path == other.path &&
        description == other.description &&
        i18nKey == other.i18nKey &&
        sort == other.sort &&
        isShow == other.isShow;
  }

  @override
  int get hashCode {
    var _$hash = 0;
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
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'CreateAdminMenuDto')
          ..add('parentId', parentId)
          ..add('type', type)
          ..add('title', title)
          ..add('icon', icon)
          ..add('code', code)
          ..add('path', path)
          ..add('description', description)
          ..add('i18nKey', i18nKey)
          ..add('sort', sort)
          ..add('isShow', isShow))
        .toString();
  }
}

class CreateAdminMenuDtoBuilder
    implements Builder<CreateAdminMenuDto, CreateAdminMenuDtoBuilder> {
  _$CreateAdminMenuDto? _$v;

  String? _parentId;
  String? get parentId => _$this._parentId;
  set parentId(String? parentId) => _$this._parentId = parentId;

  String? _type;
  String? get type => _$this._type;
  set type(String? type) => _$this._type = type;

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

  CreateAdminMenuDtoBuilder() {
    CreateAdminMenuDto._defaults(this);
  }

  CreateAdminMenuDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
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
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CreateAdminMenuDto other) {
    _$v = other as _$CreateAdminMenuDto;
  }

  @override
  void update(void Function(CreateAdminMenuDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  CreateAdminMenuDto build() => _build();

  _$CreateAdminMenuDto _build() {
    final _$result =
        _$v ??
        _$CreateAdminMenuDto._(
          parentId: parentId,
          type: BuiltValueNullFieldError.checkNotNull(
            type,
            r'CreateAdminMenuDto',
            'type',
          ),
          title: BuiltValueNullFieldError.checkNotNull(
            title,
            r'CreateAdminMenuDto',
            'title',
          ),
          icon: icon,
          code: code,
          path: path,
          description: description,
          i18nKey: i18nKey,
          sort: sort,
          isShow: isShow,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
