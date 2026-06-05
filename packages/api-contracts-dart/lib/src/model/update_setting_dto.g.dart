// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_setting_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const UpdateSettingDtoTypeEnum _$updateSettingDtoTypeEnum_string =
    const UpdateSettingDtoTypeEnum._('string');
const UpdateSettingDtoTypeEnum _$updateSettingDtoTypeEnum_number =
    const UpdateSettingDtoTypeEnum._('number');
const UpdateSettingDtoTypeEnum _$updateSettingDtoTypeEnum_boolean =
    const UpdateSettingDtoTypeEnum._('boolean');
const UpdateSettingDtoTypeEnum _$updateSettingDtoTypeEnum_json =
    const UpdateSettingDtoTypeEnum._('json');

UpdateSettingDtoTypeEnum _$updateSettingDtoTypeEnumValueOf(String name) {
  switch (name) {
    case 'string':
      return _$updateSettingDtoTypeEnum_string;
    case 'number':
      return _$updateSettingDtoTypeEnum_number;
    case 'boolean':
      return _$updateSettingDtoTypeEnum_boolean;
    case 'json':
      return _$updateSettingDtoTypeEnum_json;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<UpdateSettingDtoTypeEnum> _$updateSettingDtoTypeEnumValues =
    BuiltSet<UpdateSettingDtoTypeEnum>(const <UpdateSettingDtoTypeEnum>[
      _$updateSettingDtoTypeEnum_string,
      _$updateSettingDtoTypeEnum_number,
      _$updateSettingDtoTypeEnum_boolean,
      _$updateSettingDtoTypeEnum_json,
    ]);

Serializer<UpdateSettingDtoTypeEnum> _$updateSettingDtoTypeEnumSerializer =
    _$UpdateSettingDtoTypeEnumSerializer();

class _$UpdateSettingDtoTypeEnumSerializer
    implements PrimitiveSerializer<UpdateSettingDtoTypeEnum> {
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
  final Iterable<Type> types = const <Type>[UpdateSettingDtoTypeEnum];
  @override
  final String wireName = 'UpdateSettingDtoTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    UpdateSettingDtoTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  UpdateSettingDtoTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => UpdateSettingDtoTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$UpdateSettingDto extends UpdateSettingDto {
  @override
  final UpdateSettingDtoValue value;
  @override
  final UpdateSettingDtoTypeEnum? type;
  @override
  final String? description;
  @override
  final String? category;
  @override
  final bool? isSystem;

  factory _$UpdateSettingDto([
    void Function(UpdateSettingDtoBuilder)? updates,
  ]) => (UpdateSettingDtoBuilder()..update(updates))._build();

  _$UpdateSettingDto._({
    required this.value,
    this.type,
    this.description,
    this.category,
    this.isSystem,
  }) : super._();
  @override
  UpdateSettingDto rebuild(void Function(UpdateSettingDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  UpdateSettingDtoBuilder toBuilder() =>
      UpdateSettingDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is UpdateSettingDto &&
        value == other.value &&
        type == other.type &&
        description == other.description &&
        category == other.category &&
        isSystem == other.isSystem;
  }

  @override
  int get hashCode {
    var _$hash = 0;
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
    return (newBuiltValueToStringHelper(r'UpdateSettingDto')
          ..add('value', value)
          ..add('type', type)
          ..add('description', description)
          ..add('category', category)
          ..add('isSystem', isSystem))
        .toString();
  }
}

class UpdateSettingDtoBuilder
    implements Builder<UpdateSettingDto, UpdateSettingDtoBuilder> {
  _$UpdateSettingDto? _$v;

  UpdateSettingDtoValueBuilder? _value;
  UpdateSettingDtoValueBuilder get value =>
      _$this._value ??= UpdateSettingDtoValueBuilder();
  set value(UpdateSettingDtoValueBuilder? value) => _$this._value = value;

  UpdateSettingDtoTypeEnum? _type;
  UpdateSettingDtoTypeEnum? get type => _$this._type;
  set type(UpdateSettingDtoTypeEnum? type) => _$this._type = type;

  String? _description;
  String? get description => _$this._description;
  set description(String? description) => _$this._description = description;

  String? _category;
  String? get category => _$this._category;
  set category(String? category) => _$this._category = category;

  bool? _isSystem;
  bool? get isSystem => _$this._isSystem;
  set isSystem(bool? isSystem) => _$this._isSystem = isSystem;

  UpdateSettingDtoBuilder() {
    UpdateSettingDto._defaults(this);
  }

  UpdateSettingDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
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
  void replace(UpdateSettingDto other) {
    _$v = other as _$UpdateSettingDto;
  }

  @override
  void update(void Function(UpdateSettingDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  UpdateSettingDto build() => _build();

  _$UpdateSettingDto _build() {
    _$UpdateSettingDto _$result;
    try {
      _$result =
          _$v ??
          _$UpdateSettingDto._(
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
          r'UpdateSettingDto',
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
