//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/open_order_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'trader_open_orders_response_dto.g.dart';

/// TraderOpenOrdersResponseDto
///
/// Properties:
/// * [orders] - 挂单列表
@BuiltValue()
abstract class TraderOpenOrdersResponseDto implements Built<TraderOpenOrdersResponseDto, TraderOpenOrdersResponseDtoBuilder> {
  /// 挂单列表
  @BuiltValueField(wireName: r'orders')
  BuiltList<OpenOrderDto> get orders;

  TraderOpenOrdersResponseDto._();

  factory TraderOpenOrdersResponseDto([void updates(TraderOpenOrdersResponseDtoBuilder b)]) = _$TraderOpenOrdersResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(TraderOpenOrdersResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<TraderOpenOrdersResponseDto> get serializer => _$TraderOpenOrdersResponseDtoSerializer();
}

class _$TraderOpenOrdersResponseDtoSerializer implements PrimitiveSerializer<TraderOpenOrdersResponseDto> {
  @override
  final Iterable<Type> types = const [TraderOpenOrdersResponseDto, _$TraderOpenOrdersResponseDto];

  @override
  final String wireName = r'TraderOpenOrdersResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    TraderOpenOrdersResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'orders';
    yield serializers.serialize(
      object.orders,
      specifiedType: const FullType(BuiltList, [FullType(OpenOrderDto)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    TraderOpenOrdersResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required TraderOpenOrdersResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'orders':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(OpenOrderDto)]),
          ) as BuiltList<OpenOrderDto>;
          result.orders.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  TraderOpenOrdersResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = TraderOpenOrdersResponseDtoBuilder();
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

