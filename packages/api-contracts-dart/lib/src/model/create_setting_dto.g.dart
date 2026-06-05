// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_setting_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const CreateSettingDtoTypeEnum _$createSettingDtoTypeEnum_string =
    const CreateSettingDtoTypeEnum._('string');
const CreateSettingDtoTypeEnum _$createSettingDtoTypeEnum_number =
    const CreateSettingDtoTypeEnum._('number');
const CreateSettingDtoTypeEnum _$createSettingDtoTypeEnum_boolean =
    const CreateSettingDtoTypeEnum._('boolean');
const CreateSettingDtoTypeEnum _$createSettingDtoTypeEnum_json =
    const CreateSettingDtoTypeEnum._('json');

CreateSettingDtoTypeEnum _$createSettingDtoTypeEnumValueOf(String name) {
  switch (name) {
    case 'string':
      return _$createSettingDtoTypeEnum_string;
    case 'number':
      return _$createSettingDtoTypeEnum_number;
    case 'boolean':
      return _$createSettingDtoTypeEnum_boolean;
    case 'json':
      return _$createSettingDtoTypeEnum_json;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<CreateSettingDtoTypeEnum> _$createSettingDtoTypeEnumValues =
    BuiltSet<CreateSettingDtoTypeEnum>(const <CreateSettingDtoTypeEnum>[
      _$createSettingDtoTypeEnum_string,
      _$createSettingDtoTypeEnum_number,
      _$createSettingDtoTypeEnum_boolean,
      _$createSettingDtoTypeEnum_json,
    ]);

Serializer<CreateSettingDtoTypeEnum> _$createSettingDtoTypeEnumSerializer =
    _$CreateSettingDtoTypeEnumSerializer();

class _$CreateSettingDtoTypeEnumSerializer
    implements PrimitiveSerializer<CreateSettingDtoTypeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'string': 'string',
    'number': 'number',
    'boolean': 'boolean',
    'json': 'json',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'string': 'string',
    'number': 'number',
    'boolean': 'boolean',
    'json': 'json',
  };

  @override
  final Iterable<Type> types = const <Type>[CreateSettingDtoTypeEnum];
  @override
  final String wireName = 'CreateSettingDtoTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    CreateSettingDtoTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  CreateSettingDtoTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => CreateSettingDtoTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$CreateSettingDto extends CreateSettingDto {
  @override
  final String key;
  @override
  final CreateSettingDtoValue value;
  @override
  final CreateSettingDtoTypeEnum? type;
  @override
  final String? description;
  @override
  final String? category;
  @override
  final bool? isSystem;

  factory _$CreateSettingDto([
    void Function(CreateSettingDtoBuilder)? updates,
  ]) => (CreateSettingDtoBuilder()..update(updates))._build();

  _$CreateSettingDto._({
    required this.key,
    required this.value,
    this.type,
    this.description,
    this.category,
    this.isSystem,
  }) : super._();
  @override
  CreateSettingDto rebuild(void Function(CreateSettingDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  CreateSettingDtoBuilder toBuilder() =>
      CreateSettingDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CreateSettingDto &&
        key == other.key &&
        value == other.value &&
        type == other.type &&
        description == other.description &&
        category == other.category &&
        isSystem == other.isSystem;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, key.hashCode);
    _$hash = $jc(_$hash, value.hashCode);
    _$hash = $jc(_$hash, type.hashCode);
    _$hash = $jc(_$hash, description.hashCode);
    _$hash = $jc(_$hash, category.hashCode);
    _$hash = $jc(_$hash, isSystem.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'CreateSettingDto')
          ..add('key', key)
          ..add('value', value)
          ..add('type', type)
          ..add('description', description)
          ..add('category', category)
          ..add('isSystem', isSystem))
        .toString();
  }
}

class CreateSettingDtoBuilder
    implements Builder<CreateSettingDto, CreateSettingDtoBuilder> {
  _$CreateSettingDto? _$v;

  String? _key;
  String? get key => _$this._key;
  set key(String? key) => _$this._key = key;

  CreateSettingDtoValueBuilder? _value;
  CreateSettingDtoValueBuilder get value =>
      _$this._value ??= CreateSettingDtoValueBuilder();
  set value(CreateSettingDtoValueBuilder? value) => _$this._value = value;

  CreateSettingDtoTypeEnum? _type;
  CreateSettingDtoTypeEnum? get type => _$this._type;
  set type(CreateSettingDtoTypeEnum? type) => _$this._type = type;

  String? _description;
  String? get description => _$this._description;
  set description(String? description) => _$this._description = description;

  String? _category;
  String? get category => _$this._category;
  set category(String? category) => _$this._category = category;

  bool? _isSystem;
  bool? get isSystem => _$this._isSystem;
  set isSystem(bool? isSystem) => _$this._isSystem = isSystem;

  CreateSettingDtoBuilder() {
    CreateSettingDto._defaults(this);
  }

  CreateSettingDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _key = $v.key;
      _value = $v.value.toBuilder();
      _type = $v.type;
      _description = $v.description;
      _category = $v.category;
      _isSystem = $v.isSystem;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CreateSettingDto other) {
    _$v = other as _$CreateSettingDto;
  }

  @override
  void update(void Function(CreateSettingDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  CreateSettingDto build() => _build();

  _$CreateSettingDto _build() {
    _$CreateSettingDto _$result;
    try {
      _$result =
          _$v ??
          _$CreateSettingDto._(
            key: BuiltValueNullFieldError.checkNotNull(
              key,
              r'CreateSettingDto',
              'key',
            ),
            value: value.build(),
            type: type,
            description: description,
            category: category,
            isSystem: isSystem,
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'value';
        value.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'CreateSettingDto',
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
