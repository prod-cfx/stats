//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/venue_order_book_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_orderbook_pair_config_controller_get_current_orderbook200_response.g.dart';

/// AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response implements Built<AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response, AdminOrderbookPairConfigControllerGetCurrentOrderbook200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  VenueOrderBookDto? get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response._();

  factory AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response([void updates(AdminOrderbookPairConfigControllerGetCurrentOrderbook200ResponseBuilder b)]) = _$AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminOrderbookPairConfigControllerGetCurrentOrderbook200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response> get serializer => _$AdminOrderbookPairConfigControllerGetCurrentOrderbook200ResponseSerializer();
}

class _$AdminOrderbookPairConfigControllerGetCurrentOrderbook200ResponseSerializer implements PrimitiveSerializer<AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response> {
  @override
  final Iterable<Type> types = const [AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response, _$AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response];

  @override
  final String wireName = r'AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.data != null) {
      yield r'data';
      yield serializers.serialize(
        object.data,
        specifiedType: const FullType(VenueOrderBookDto),
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
    AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminOrderbookPairConfigControllerGetCurrentOrderbook200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(VenueOrderBookDto),
          ) as VenueOrderBookDto;
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
  AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminOrderbookPairConfigControllerGetCurrentOrderbook200ResponseBuilder();
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

