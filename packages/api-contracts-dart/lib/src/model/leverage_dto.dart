//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'leverage_dto.g.dart';

/// LeverageDto
///
/// Properties:
/// * [type] - 杠杆类型
/// * [value] - 杠杆倍数
@BuiltValue()
abstract class LeverageDto implements Built<LeverageDto, LeverageDtoBuilder> {
  /// 杠杆类型
  @BuiltValueField(wireName: r'type')
  LeverageDtoTypeEnum get type;
  // enum typeEnum {  cross,  isolated,  };

  /// 杠杆倍数
  @BuiltValueField(wireName: r'value')
  num get value;

  LeverageDto._();

  factory LeverageDto([void updates(LeverageDtoBuilder b)]) = _$LeverageDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(LeverageDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<LeverageDto> get serializer => _$LeverageDtoSerializer();
}

class _$LeverageDtoSerializer implements PrimitiveSerializer<LeverageDto> {
  @override
  final Iterable<Type> types = const [LeverageDto, _$LeverageDto];

  @override
  final String wireName = r'LeverageDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    LeverageDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'type';
    yield serializers.serialize(
      object.type,
      specifiedType: const FullType(LeverageDtoTypeEnum),
    );
    yield r'value';
    yield serializers.serialize(
      object.value,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    LeverageDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required LeverageDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'type':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(LeverageDtoTypeEnum),
          ) as LeverageDtoTypeEnum;
          result.type = valueDes;
          break;
        case r'value':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.value = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  LeverageDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = LeverageDtoBuilder();
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

class LeverageDtoTypeEnum extends EnumClass {

  /// 杠杆类型
  @BuiltValueEnumConst(wireName: r'cross')
  static const LeverageDtoTypeEnum cross = _$leverageDtoTypeEnum_cross;
  /// 杠杆类型
  @BuiltValueEnumConst(wireName: r'isolated')
  static const LeverageDtoTypeEnum isolated = _$leverageDtoTypeEnum_isolated;

  static Serializer<LeverageDtoTypeEnum> get serializer => _$leverageDtoTypeEnumSerializer;

  const LeverageDtoTypeEnum._(String name): super(name);

  static BuiltSet<LeverageDtoTypeEnum> get values => _$leverageDtoTypeEnumValues;
  static LeverageDtoTypeEnum valueOf(String name) => _$leverageDtoTypeEnumValueOf(name);
}

