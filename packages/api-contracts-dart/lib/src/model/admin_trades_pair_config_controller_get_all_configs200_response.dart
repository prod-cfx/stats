//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/trades_pair_config_response_dto.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_trades_pair_config_controller_get_all_configs200_response.g.dart';

/// AdminTradesPairConfigControllerGetAllConfigs200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class AdminTradesPairConfigControllerGetAllConfigs200Response implements Built<AdminTradesPairConfigControllerGetAllConfigs200Response, AdminTradesPairConfigControllerGetAllConfigs200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  BuiltList<TradesPairConfigResponseDto>? get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  AdminTradesPairConfigControllerGetAllConfigs200Response._();

  factory AdminTradesPairConfigControllerGetAllConfigs200Response([void updates(AdminTradesPairConfigControllerGetAllConfigs200ResponseBuilder b)]) = _$AdminTradesPairConfigControllerGetAllConfigs200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminTradesPairConfigControllerGetAllConfigs200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminTradesPairConfigControllerGetAllConfigs200Response> get serializer => _$AdminTradesPairConfigControllerGetAllConfigs200ResponseSerializer();
}

class _$AdminTradesPairConfigControllerGetAllConfigs200ResponseSerializer implements PrimitiveSerializer<AdminTradesPairConfigControllerGetAllConfigs200Response> {
  @override
  final Iterable<Type> types = const [AdminTradesPairConfigControllerGetAllConfigs200Response, _$AdminTradesPairConfigControllerGetAllConfigs200Response];

  @override
  final String wireName = r'AdminTradesPairConfigControllerGetAllConfigs200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminTradesPairConfigControllerGetAllConfigs200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.data != null) {
      yield r'data';
      yield serializers.serialize(
        object.data,
        specifiedType: const FullType(BuiltList, [FullType(TradesPairConfigResponseDto)]),
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
    AdminTradesPairConfigControllerGetAllConfigs200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminTradesPairConfigControllerGetAllConfigs200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(TradesPairConfigResponseDto)]),
          ) as BuiltList<TradesPairConfigResponseDto>;
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
  AdminTradesPairConfigControllerGetAllConfigs200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminTradesPairConfigControllerGetAllConfigs200ResponseBuilder();
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

