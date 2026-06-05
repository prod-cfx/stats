//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/open_interest_dto.dart';
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/base_response_dto.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'open_interest_controller_batch_upsert201_response.g.dart';

/// OpenInterestControllerBatchUpsert201Response
///
/// Properties:
/// * [data] 
/// * [message] - 提示信息
@BuiltValue()
abstract class OpenInterestControllerBatchUpsert201Response implements BaseResponseDto, Built<OpenInterestControllerBatchUpsert201Response, OpenInterestControllerBatchUpsert201ResponseBuilder> {
  OpenInterestControllerBatchUpsert201Response._();

  factory OpenInterestControllerBatchUpsert201Response([void updates(OpenInterestControllerBatchUpsert201ResponseBuilder b)]) = _$OpenInterestControllerBatchUpsert201Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(OpenInterestControllerBatchUpsert201ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<OpenInterestControllerBatchUpsert201Response> get serializer => _$OpenInterestControllerBatchUpsert201ResponseSerializer();
}

class _$OpenInterestControllerBatchUpsert201ResponseSerializer implements PrimitiveSerializer<OpenInterestControllerBatchUpsert201Response> {
  @override
  final Iterable<Type> types = const [OpenInterestControllerBatchUpsert201Response, _$OpenInterestControllerBatchUpsert201Response];

  @override
  final String wireName = r'OpenInterestControllerBatchUpsert201Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    OpenInterestControllerBatchUpsert201Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'data';
    yield serializers.serialize(
      object.data,
      specifiedType: const FullType(JsonObject),
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
    OpenInterestControllerBatchUpsert201Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required OpenInterestControllerBatchUpsert201ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(JsonObject),
          ) as JsonObject;
          result.data = valueDes;
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
  OpenInterestControllerBatchUpsert201Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = OpenInterestControllerBatchUpsert201ResponseBuilder();
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

