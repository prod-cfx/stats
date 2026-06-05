//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'order_book_level_dto.g.dart';

/// OrderBookLevelDto
///
/// Properties:
/// * [price] - 价格（统一为 base-quote 价格，例如 BTC/USDT）
/// * [size] - 数量（base 数量，例如 0.1 BTC）
@BuiltValue()
abstract class OrderBookLevelDto implements Built<OrderBookLevelDto, OrderBookLevelDtoBuilder> {
  /// 价格（统一为 base-quote 价格，例如 BTC/USDT）
  @BuiltValueField(wireName: r'price')
  num get price;

  /// 数量（base 数量，例如 0.1 BTC）
  @BuiltValueField(wireName: r'size')
  num get size;

  OrderBookLevelDto._();

  factory OrderBookLevelDto([void updates(OrderBookLevelDtoBuilder b)]) = _$OrderBookLevelDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(OrderBookLevelDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<OrderBookLevelDto> get serializer => _$OrderBookLevelDtoSerializer();
}

class _$OrderBookLevelDtoSerializer implements PrimitiveSerializer<OrderBookLevelDto> {
  @override
  final Iterable<Type> types = const [OrderBookLevelDto, _$OrderBookLevelDto];

  @override
  final String wireName = r'OrderBookLevelDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    OrderBookLevelDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'price';
    yield serializers.serialize(
      object.price,
      specifiedType: const FullType(num),
    );
    yield r'size';
    yield serializers.serialize(
      object.size,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    OrderBookLevelDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required OrderBookLevelDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'price':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.price = valueDes;
          break;
        case r'size':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.size = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  OrderBookLevelDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = OrderBookLevelDtoBuilder();
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

