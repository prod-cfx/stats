//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/backtesting_job_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'backtesting_proxy_controller_get_job200_response.g.dart';

/// BacktestingProxyControllerGetJob200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class BacktestingProxyControllerGetJob200Response implements Built<BacktestingProxyControllerGetJob200Response, BacktestingProxyControllerGetJob200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  BacktestingJobResponseDto get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  BacktestingProxyControllerGetJob200Response._();

  factory BacktestingProxyControllerGetJob200Response([void updates(BacktestingProxyControllerGetJob200ResponseBuilder b)]) = _$BacktestingProxyControllerGetJob200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(BacktestingProxyControllerGetJob200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<BacktestingProxyControllerGetJob200Response> get serializer => _$BacktestingProxyControllerGetJob200ResponseSerializer();
}

class _$BacktestingProxyControllerGetJob200ResponseSerializer implements PrimitiveSerializer<BacktestingProxyControllerGetJob200Response> {
  @override
  final Iterable<Type> types = const [BacktestingProxyControllerGetJob200Response, _$BacktestingProxyControllerGetJob200Response];

  @override
  final String wireName = r'BacktestingProxyControllerGetJob200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BacktestingProxyControllerGetJob200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'data';
    yield serializers.serialize(
      object.data,
      specifiedType: const FullType(BacktestingJobResponseDto),
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
    BacktestingProxyControllerGetJob200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BacktestingProxyControllerGetJob200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BacktestingJobResponseDto),
          ) as BacktestingJobResponseDto;
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
  BacktestingProxyControllerGetJob200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = BacktestingProxyControllerGetJob200ResponseBuilder();
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

