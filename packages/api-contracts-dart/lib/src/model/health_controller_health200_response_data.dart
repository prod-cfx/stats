//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'health_controller_health200_response_data.g.dart';

/// HealthControllerHealth200ResponseData
///
/// Properties:
/// * [service] 
/// * [status] 
/// * [timestamp] 
@BuiltValue()
abstract class HealthControllerHealth200ResponseData implements Built<HealthControllerHealth200ResponseData, HealthControllerHealth200ResponseDataBuilder> {
  @BuiltValueField(wireName: r'service')
  String? get service;

  @BuiltValueField(wireName: r'status')
  HealthControllerHealth200ResponseDataStatusEnum? get status;
  // enum statusEnum {  ok,  degraded,  down,  };

  @BuiltValueField(wireName: r'timestamp')
  String? get timestamp;

  HealthControllerHealth200ResponseData._();

  factory HealthControllerHealth200ResponseData([void updates(HealthControllerHealth200ResponseDataBuilder b)]) = _$HealthControllerHealth200ResponseData;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(HealthControllerHealth200ResponseDataBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<HealthControllerHealth200ResponseData> get serializer => _$HealthControllerHealth200ResponseDataSerializer();
}

class _$HealthControllerHealth200ResponseDataSerializer implements PrimitiveSerializer<HealthControllerHealth200ResponseData> {
  @override
  final Iterable<Type> types = const [HealthControllerHealth200ResponseData, _$HealthControllerHealth200ResponseData];

  @override
  final String wireName = r'HealthControllerHealth200ResponseData';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    HealthControllerHealth200ResponseData object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.service != null) {
      yield r'service';
      yield serializers.serialize(
        object.service,
        specifiedType: const FullType(String),
      );
    }
    if (object.status != null) {
      yield r'status';
      yield serializers.serialize(
        object.status,
        specifiedType: const FullType(HealthControllerHealth200ResponseDataStatusEnum),
      );
    }
    if (object.timestamp != null) {
      yield r'timestamp';
      yield serializers.serialize(
        object.timestamp,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    HealthControllerHealth200ResponseData object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required HealthControllerHealth200ResponseDataBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'service':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.service = valueDes;
          break;
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(HealthControllerHealth200ResponseDataStatusEnum),
          ) as HealthControllerHealth200ResponseDataStatusEnum;
          result.status = valueDes;
          break;
        case r'timestamp':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.timestamp = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  HealthControllerHealth200ResponseData deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = HealthControllerHealth200ResponseDataBuilder();
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

class HealthControllerHealth200ResponseDataStatusEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'ok')
  static const HealthControllerHealth200ResponseDataStatusEnum ok = _$healthControllerHealth200ResponseDataStatusEnum_ok;
  @BuiltValueEnumConst(wireName: r'degraded')
  static const HealthControllerHealth200ResponseDataStatusEnum degraded = _$healthControllerHealth200ResponseDataStatusEnum_degraded;
  @BuiltValueEnumConst(wireName: r'down')
  static const HealthControllerHealth200ResponseDataStatusEnum down = _$healthControllerHealth200ResponseDataStatusEnum_down;

  static Serializer<HealthControllerHealth200ResponseDataStatusEnum> get serializer => _$healthControllerHealth200ResponseDataStatusEnumSerializer;

  const HealthControllerHealth200ResponseDataStatusEnum._(String name): super(name);

  static BuiltSet<HealthControllerHealth200ResponseDataStatusEnum> get values => _$healthControllerHealth200ResponseDataStatusEnumValues;
  static HealthControllerHealth200ResponseDataStatusEnum valueOf(String name) => _$healthControllerHealth200ResponseDataStatusEnumValueOf(name);
}

