//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/health_controller_health200_response_data.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'health_controller_health200_response.g.dart';

/// HealthControllerHealth200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class HealthControllerHealth200Response implements Built<HealthControllerHealth200Response, HealthControllerHealth200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  HealthControllerHealth200ResponseData? get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  HealthControllerHealth200Response._();

  factory HealthControllerHealth200Response([void updates(HealthControllerHealth200ResponseBuilder b)]) = _$HealthControllerHealth200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(HealthControllerHealth200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<HealthControllerHealth200Response> get serializer => _$HealthControllerHealth200ResponseSerializer();
}

class _$HealthControllerHealth200ResponseSerializer implements PrimitiveSerializer<HealthControllerHealth200Response> {
  @override
  final Iterable<Type> types = const [HealthControllerHealth200Response, _$HealthControllerHealth200Response];

  @override
  final String wireName = r'HealthControllerHealth200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    HealthControllerHealth200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.data != null) {
      yield r'data';
      yield serializers.serialize(
        object.data,
        specifiedType: const FullType(HealthControllerHealth200ResponseData),
      );
    }
    if (object.message != null) {
      yield r'message';
      yield serializers.serialize(
        object.message,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    HealthControllerHealth200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required HealthControllerHealth200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(HealthControllerHealth200ResponseData),
          ) as HealthControllerHealth200ResponseData;
          result.data.replace(valueDes);
          break;
        case r'message':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.message = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  HealthControllerHealth200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = HealthControllerHealth200ResponseBuilder();
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

