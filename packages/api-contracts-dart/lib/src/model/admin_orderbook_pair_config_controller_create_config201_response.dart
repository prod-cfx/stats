//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/orderbook_pair_config_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_orderbook_pair_config_controller_create_config201_response.g.dart';

/// AdminOrderbookPairConfigControllerCreateConfig201Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class AdminOrderbookPairConfigControllerCreateConfig201Response implements Built<AdminOrderbookPairConfigControllerCreateConfig201Response, AdminOrderbookPairConfigControllerCreateConfig201ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  OrderbookPairConfigResponseDto? get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  AdminOrderbookPairConfigControllerCreateConfig201Response._();

  factory AdminOrderbookPairConfigControllerCreateConfig201Response([void updates(AdminOrderbookPairConfigControllerCreateConfig201ResponseBuilder b)]) = _$AdminOrderbookPairConfigControllerCreateConfig201Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminOrderbookPairConfigControllerCreateConfig201ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminOrderbookPairConfigControllerCreateConfig201Response> get serializer => _$AdminOrderbookPairConfigControllerCreateConfig201ResponseSerializer();
}

class _$AdminOrderbookPairConfigControllerCreateConfig201ResponseSerializer implements PrimitiveSerializer<AdminOrderbookPairConfigControllerCreateConfig201Response> {
  @override
  final Iterable<Type> types = const [AdminOrderbookPairConfigControllerCreateConfig201Response, _$AdminOrderbookPairConfigControllerCreateConfig201Response];

  @override
  final String wireName = r'AdminOrderbookPairConfigControllerCreateConfig201Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminOrderbookPairConfigControllerCreateConfig201Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.data != null) {
      yield r'data';
      yield serializers.serialize(
        object.data,
        specifiedType: const FullType(OrderbookPairConfigResponseDto),
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
    AdminOrderbookPairConfigControllerCreateConfig201Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminOrderbookPairConfigControllerCreateConfig201ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(OrderbookPairConfigResponseDto),
          ) as OrderbookPairConfigResponseDto;
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
  AdminOrderbookPairConfigControllerCreateConfig201Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminOrderbookPairConfigControllerCreateConfig201ResponseBuilder();
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

