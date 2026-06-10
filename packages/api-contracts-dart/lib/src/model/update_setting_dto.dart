//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/create_setting_dto_value.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'update_setting_dto.g.dart';

/// UpdateSettingDto
///
/// Properties:
/// * [value] 
/// * [type] - 值类型
/// * [description] - 配置描述
/// * [category] - 配置分类
/// * [isSystem] - 是否系统配置
@BuiltValue()
abstract class UpdateSettingDto implements Built<UpdateSettingDto, UpdateSettingDtoBuilder> {
  @BuiltValueField(wireName: r'value')
  CreateSettingDtoValue get value;

  /// 值类型
  @BuiltValueField(wireName: r'type')
  UpdateSettingDtoTypeEnum? get type;
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

  UpdateSettingDto._();

  factory UpdateSettingDto([void updates(UpdateSettingDtoBuilder b)]) = _$UpdateSettingDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(UpdateSettingDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<UpdateSettingDto> get serializer => _$UpdateSettingDtoSerializer();
}

class _$UpdateSettingDtoSerializer implements PrimitiveSerializer<UpdateSettingDto> {
  @override
  final Iterable<Type> types = const [UpdateSettingDto, _$UpdateSettingDto];

  @override
  final String wireName = r'UpdateSettingDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    UpdateSettingDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'value';
    yield serializers.serialize(
      object.value,
      specifiedType: const FullType(CreateSettingDtoValue),
    );
    if (object.type != null) {
      yield r'type';
      yield serializers.serialize(
        object.type,
        specifiedType: const FullType(UpdateSettingDtoTypeEnum),
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
    UpdateSettingDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required UpdateSettingDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
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
            specifiedType: const FullType(UpdateSettingDtoTypeEnum),
          ) as UpdateSettingDtoTypeEnum;
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
  UpdateSettingDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = UpdateSettingDtoBuilder();
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

class UpdateSettingDtoTypeEnum extends EnumClass {

  /// 值类型
  @BuiltValueEnumConst(wireName: r'string')
  static const UpdateSettingDtoTypeEnum string = _$updateSettingDtoTypeEnum_string;
  /// 值类型
  @BuiltValueEnumConst(wireName: r'number')
  static const UpdateSettingDtoTypeEnum number = _$updateSettingDtoTypeEnum_number;
  /// 值类型
  @BuiltValueEnumConst(wireName: r'boolean')
  static const UpdateSettingDtoTypeEnum boolean = _$updateSettingDtoTypeEnum_boolean;
  /// 值类型
  @BuiltValueEnumConst(wireName: r'json')
  static const UpdateSettingDtoTypeEnum json = _$updateSettingDtoTypeEnum_json;

  static Serializer<UpdateSettingDtoTypeEnum> get serializer => _$updateSettingDtoTypeEnumSerializer;

  const UpdateSettingDtoTypeEnum._(String name): super(name);

  static BuiltSet<UpdateSettingDtoTypeEnum> get values => _$updateSettingDtoTypeEnumValues;
  static UpdateSettingDtoTypeEnum valueOf(String name) => _$updateSettingDtoTypeEnumValueOf(name);
}

