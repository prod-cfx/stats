//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/open_interest_dto.dart';
import 'package:backend_api_contracts/src/model/base_response_dto.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'open_interest_controller_upsert201_response.g.dart';

/// OpenInterestControllerUpsert201Response
///
/// Properties:
/// * [data] 
/// * [message] - 提示信息
@BuiltValue()
abstract class OpenInterestControllerUpsert201Response implements BaseResponseDto, Built<OpenInterestControllerUpsert201Response, OpenInterestControllerUpsert201ResponseBuilder> {
  OpenInterestControllerUpsert201Response._();

  factory OpenInterestControllerUpsert201Response([void updates(OpenInterestControllerUpsert201ResponseBuilder b)]) = _$OpenInterestControllerUpsert201Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(OpenInterestControllerUpsert201ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<OpenInterestControllerUpsert201Response> get serializer => _$OpenInterestControllerUpsert201ResponseSerializer();
}

class _$OpenInterestControllerUpsert201ResponseSerializer implements PrimitiveSerializer<OpenInterestControllerUpsert201Response> {
  @override
  final Iterable<Type> types = const [OpenInterestControllerUpsert201Response, _$OpenInterestControllerUpsert201Response];

  @override
  final String wireName = r'OpenInterestControllerUpsert201Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    OpenInterestControllerUpsert201Response object, {
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
    OpenInterestControllerUpsert201Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required OpenInterestControllerUpsert201ResponseBuilder result,
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
  OpenInterestControllerUpsert201Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = OpenInterestControllerUpsert201ResponseBuilder();
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

