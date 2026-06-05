// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'setting_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$SettingResponseDto extends SettingResponseDto {
  @override
  final String id;
  @override
  final String key;
  @override
  final String value;
  @override
  final String type;
  @override
  final String description;
  @override
  final String category;
  @override
  final bool isSystem;
  @override
  final DateTime createdAt;
  @override
  final DateTime updatedAt;

  factory _$SettingResponseDto([
    void Function(SettingResponseDtoBuilder)? updates,
  ]) => (SettingResponseDtoBuilder()..update(updates))._build();

  _$SettingResponseDto._({
    required this.id,
    required this.key,
    required this.value,
    required this.type,
    required this.description,
    required this.category,
    required this.isSystem,
    required this.createdAt,
    required this.updatedAt,
  }) : super._();
  @override
  SettingResponseDto rebuild(
    void Function(SettingResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  SettingResponseDtoBuilder toBuilder() =>
      SettingResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is SettingResponseDto &&
        id == other.id &&
        key == other.key &&
        value == other.value &&
        type == other.type &&
        description == other.description &&
        category == other.category &&
        isSystem == other.isSystem &&
        createdAt == other.createdAt &&
        updatedAt == other.updatedAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, key.hashCode);
    _$hash = $jc(_$hash, value.hashCode);
    _$hash = $jc(_$hash, type.hashCode);
    _$hash = $jc(_$hash, description.hashCode);
    _$hash = $jc(_$hash, category.hashCode);
    _$hash = $jc(_$hash, isSystem.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jc(_$hash, updatedAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'SettingResponseDto')
          ..add('id', id)
          ..add('key', key)
          ..add('value', value)
          ..add('type', type)
          ..add('description', description)
          ..add('category', category)
          ..add('isSystem', isSystem)
          ..add('createdAt', createdAt)
          ..add('updatedAt', updatedAt))
        .toString();
  }
}

class SettingResponseDtoBuilder
    implements Builder<SettingResponseDto, SettingResponseDtoBuilder> {
  _$SettingResponseDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _key;
  String? get key => _$this._key;
  set key(String? key) => _$this._key = key;

  String? _value;
  String? get value => _$this._value;
  set value(String? value) => _$this._value = value;

  String? _type;
  String? get type => _$this._type;
  set type(String? type) => _$this._type = type;

  String? _description;
  String? get description => _$this._description;
  set description(String? description) => _$this._description = description;

  String? _category;
  String? get category => _$this._category;
  set category(String? category) => _$this._category = category;

  bool? _isSystem;
  bool? get isSystem => _$this._isSystem;
  set isSystem(bool? isSystem) => _$this._isSystem = isSystem;

  DateTime? _createdAt;
  DateTime? get createdAt => _$this._createdAt;
  set createdAt(DateTime? createdAt) => _$this._createdAt = createdAt;

  DateTime? _updatedAt;
  DateTime? get updatedAt => _$this._updatedAt;
  set updatedAt(DateTime? updatedAt) => _$this._updatedAt = updatedAt;

  SettingResponseDtoBuilder() {
    SettingResponseDto._defaults(this);
  }

  SettingResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _key = $v.key;
      _value = $v.value;
      _type = $v.type;
      _description = $v.description;
      _category = $v.category;
      _isSystem = $v.isSystem;
      _createdAt = $v.createdAt;
      _updatedAt = $v.updatedAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(SettingResponseDto other) {
    _$v = other as _$SettingResponseDto;
  }

  @override
  void update(void Function(SettingResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  SettingResponseDto build() => _build();

  _$SettingResponseDto _build() {
    final _$result =
        _$v ??
        _$SettingResponseDto._(
          id: BuiltValueNullFieldError.checkNotNull(
            id,
            r'SettingResponseDto',
            'id',
          ),
          key: BuiltValueNullFieldError.checkNotNull(
            key,
            r'SettingResponseDto',
            'key',
          ),
          value: BuiltValueNullFieldError.checkNotNull(
            value,
            r'SettingResponseDto',
            'value',
          ),
          type: BuiltValueNullFieldError.checkNotNull(
            type,
            r'SettingResponseDto',
            'type',
          ),
          description: BuiltValueNullFieldError.checkNotNull(
            description,
            r'SettingResponseDto',
            'description',
          ),
          category: BuiltValueNullFieldError.checkNotNull(
            category,
            r'SettingResponseDto',
            'category',
          ),
          isSystem: BuiltValueNullFieldError.checkNotNull(
            isSystem,
            r'SettingResponseDto',
            'isSystem',
          ),
          createdAt: BuiltValueNullFieldError.checkNotNull(
            createdAt,
            r'SettingResponseDto',
            'createdAt',
          ),
          updatedAt: BuiltValueNullFieldError.checkNotNull(
            updatedAt,
            r'SettingResponseDto',
            'updatedAt',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
