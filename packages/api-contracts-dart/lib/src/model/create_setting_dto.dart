//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/create_setting_dto_value.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'create_setting_dto.g.dart';

/// CreateSettingDto
///
/// Properties:
/// * [key] - 配置键名
/// * [value] 
/// * [type] - 值类型
/// * [description] - 配置描述
/// * [category] - 配置分类
/// * [isSystem] - 是否系统配置
@BuiltValue()
abstract class CreateSettingDto implements Built<CreateSettingDto, CreateSettingDtoBuilder> {
  /// 配置键名
  @BuiltValueField(wireName: r'key')
  String get key;

  @BuiltValueField(wireName: r'value')
  CreateSettingDtoValue get value;

  /// 值类型
  @BuiltValueField(wireName: r'type')
  CreateSettingDtoTypeEnum? get type;
  // enum typeEnum {  string,  number,  boolean,  json,  };

  /// 配置描述
  @BuiltValueField(wireName: r'description')
  String? get description;

  /// 配置分类
  @BuiltValueField(wireName: r'category')
  String? get category;

  /// 是否系统配置
  @BuiltValueField(wireName: r'isSystem')
  bool? get isSystem;

  CreateSettingDto._();

  factory CreateSettingDto([void updates(CreateSettingDtoBuilder b)]) = _$CreateSettingDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CreateSettingDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<CreateSettingDto> get serializer => _$CreateSettingDtoSerializer();
}

class _$CreateSettingDtoSerializer implements PrimitiveSerializer<CreateSettingDto> {
  @override
  final Iterable<Type> types = const [CreateSettingDto, _$CreateSettingDto];

  @override
  final String wireName = r'CreateSettingDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CreateSettingDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'key';
    yield serializers.serialize(
      object.key,
      specifiedType: const FullType(String),
    );
    yield r'value';
    yield serializers.serialize(
      object.value,
      specifiedType: const FullType(CreateSettingDtoValue),
    );
    if (object.type != null) {
      yield r'type';
      yield serializers.serialize(
        object.type,
        specifiedType: const FullType(CreateSettingDtoTypeEnum),
      );
    }
    if (object.description != null) {
      yield r'description';
      yield serializers.serialize(
        object.description,
        specifiedType: const FullType(String),
      );
    }
    if (object.category != null) {
      yield r'category';
      yield serializers.serialize(
        object.category,
        specifiedType: const FullType(String),
      );
    }
    if (object.isSystem != null) {
      yield r'isSystem';
      yield serializers.serialize(
        object.isSystem,
        specifiedType: const FullType(bool),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    CreateSettingDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CreateSettingDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'key':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.key = valueDes;
          break;
        case r'value':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(CreateSettingDtoValue),
          ) as CreateSettingDtoValue;
          result.value.replace(valueDes);
          break;
        case r'type':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(CreateSettingDtoTypeEnum),
          ) as CreateSettingDtoTypeEnum;
          result.type = valueDes;
          break;
        case r'description':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.description = valueDes;
          break;
        case r'category':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.category = valueDes;
          break;
        case r'isSystem':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.isSystem = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  CreateSettingDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CreateSettingDtoBuilder();
    final serializedList = (serialized as Iterable<Object?>).toList();
    final unhandled = <Object?>[];
    _deserializeProperties(
      serializers,
      serialized,
      specifiedType: specifiedType,
      serializedList: serializedList,
      unhandled: unhandled,
      result: result,
    );
    return result.build();
  }
}

class CreateSettingDtoTypeEnum extends EnumClass {

  /// 值类型
  @BuiltValueEnumConst(wireName: r'string')
  static const CreateSettingDtoTypeEnum string = _$createSettingDtoTypeEnum_string;
  /// 值类型
  @BuiltValueEnumConst(wireName: r'number')
  static const CreateSettingDtoTypeEnum number = _$createSettingDtoTypeEnum_number;
  /// 值类型
  @BuiltValueEnumConst(wireName: r'boolean')
  static const CreateSettingDtoTypeEnum boolean = _$createSettingDtoTypeEnum_boolean;
  /// 值类型
  @BuiltValueEnumConst(wireName: r'json')
  static const CreateSettingDtoTypeEnum json = _$createSettingDtoTypeEnum_json;

  static Serializer<CreateSettingDtoTypeEnum> get serializer => _$createSettingDtoTypeEnumSerializer;

  const CreateSettingDtoTypeEnum._(String name): super(name);

  static BuiltSet<CreateSettingDtoTypeEnum> get values => _$createSettingDtoTypeEnumValues;
  static CreateSettingDtoTypeEnum valueOf(String name) => _$createSettingDtoTypeEnumValueOf(name);
}

