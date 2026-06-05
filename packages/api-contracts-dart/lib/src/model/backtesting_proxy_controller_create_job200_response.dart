//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/backtesting_create_job_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'backtesting_proxy_controller_create_job200_response.g.dart';

/// BacktestingProxyControllerCreateJob200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class BacktestingProxyControllerCreateJob200Response implements Built<BacktestingProxyControllerCreateJob200Response, BacktestingProxyControllerCreateJob200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  BacktestingCreateJobResponseDto get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  BacktestingProxyControllerCreateJob200Response._();

  factory BacktestingProxyControllerCreateJob200Response([void updates(BacktestingProxyControllerCreateJob200ResponseBuilder b)]) = _$BacktestingProxyControllerCreateJob200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(BacktestingProxyControllerCreateJob200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<BacktestingProxyControllerCreateJob200Response> get serializer => _$BacktestingProxyControllerCreateJob200ResponseSerializer();
}

class _$BacktestingProxyControllerCreateJob200ResponseSerializer implements PrimitiveSerializer<BacktestingProxyControllerCreateJob200Response> {
  @override
  final Iterable<Type> types = const [BacktestingProxyControllerCreateJob200Response, _$BacktestingProxyControllerCreateJob200Response];

  @override
  final String wireName = r'BacktestingProxyControllerCreateJob200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BacktestingProxyControllerCreateJob200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'data';
    yield serializers.serialize(
      object.data,
      specifiedType: const FullType(BacktestingCreateJobResponseDto),
    );
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
    BacktestingProxyControllerCreateJob200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BacktestingProxyControllerCreateJob200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BacktestingCreateJobResponseDto),
          ) as BacktestingCreateJobResponseDto;
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
  BacktestingProxyControllerCreateJob200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = BacktestingProxyControllerCreateJob200ResponseBuilder();
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

