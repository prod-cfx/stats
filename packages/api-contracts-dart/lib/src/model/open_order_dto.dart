//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'open_order_dto.g.dart';

/// OpenOrderDto
///
/// Properties:
/// * [orderId] - 订单 ID
/// * [coin] - 币种符号
/// * [side] - 订单方向
/// * [type] - 订单类型
/// * [price] - 限价
/// * [size] - 订单数量
/// * [origSize] - 原始数量
/// * [value] - 订单名义价值（USD）
/// * [timestamp] - 订单创建时间（ISO 8601 格式）
/// * [triggerPrice] - 触发价格（止损/止盈订单）
/// * [triggerCondition] - 触发条件
/// * [reduceOnly] - 是否只减仓
@BuiltValue()
abstract class OpenOrderDto implements Built<OpenOrderDto, OpenOrderDtoBuilder> {
  /// 订单 ID
  @BuiltValueField(wireName: r'orderId')
  num get orderId;

  /// 币种符号
  @BuiltValueField(wireName: r'coin')
  String get coin;

  /// 订单方向
  @BuiltValueField(wireName: r'side')
  OpenOrderDtoSideEnum get side;
  // enum sideEnum {  BUY,  SELL,  };

  /// 订单类型
  @BuiltValueField(wireName: r'type')
  String get type;

  /// 限价
  @BuiltValueField(wireName: r'price')
  num get price;

  /// 订单数量
  @BuiltValueField(wireName: r'size')
  num get size;

  /// 原始数量
  @BuiltValueField(wireName: r'origSize')
  num get origSize;

  /// 订单名义价值（USD）
  @BuiltValueField(wireName: r'value')
  num get value;

  /// 订单创建时间（ISO 8601 格式）
  @BuiltValueField(wireName: r'timestamp')
  String get timestamp;

  /// 触发价格（止损/止盈订单）
  @BuiltValueField(wireName: r'triggerPrice')
  num? get triggerPrice;

  /// 触发条件
  @BuiltValueField(wireName: r'triggerCondition')
  String? get triggerCondition;

  /// 是否只减仓
  @BuiltValueField(wireName: r'reduceOnly')
  bool get reduceOnly;

  OpenOrderDto._();

  factory OpenOrderDto([void updates(OpenOrderDtoBuilder b)]) = _$OpenOrderDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(OpenOrderDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<OpenOrderDto> get serializer => _$OpenOrderDtoSerializer();
}

class _$OpenOrderDtoSerializer implements PrimitiveSerializer<OpenOrderDto> {
  @override
  final Iterable<Type> types = const [OpenOrderDto, _$OpenOrderDto];

  @override
  final String wireName = r'OpenOrderDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    OpenOrderDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'orderId';
    yield serializers.serialize(
      object.orderId,
      specifiedType: const FullType(num),
    );
    yield r'coin';
    yield serializers.serialize(
      object.coin,
      specifiedType: const FullType(String),
    );
    yield r'side';
    yield serializers.serialize(
      object.side,
      specifiedType: const FullType(OpenOrderDtoSideEnum),
    );
    yield r'type';
    yield serializers.serialize(
      object.type,
      specifiedType: const FullType(String),
    );
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
    yield r'origSize';
    yield serializers.serialize(
      object.origSize,
      specifiedType: const FullType(num),
    );
    yield r'value';
    yield serializers.serialize(
      object.value,
      specifiedType: const FullType(num),
    );
    yield r'timestamp';
    yield serializers.serialize(
      object.timestamp,
      specifiedType: const FullType(String),
    );
    if (object.triggerPrice != null) {
      yield r'triggerPrice';
      yield serializers.serialize(
        object.triggerPrice,
        specifiedType: const FullType(num),
      );
    }
    if (object.triggerCondition != null) {
      yield r'triggerCondition';
      yield serializers.serialize(
        object.triggerCondition,
        specifiedType: const FullType(String),
      );
    }
    yield r'reduceOnly';
    yield serializers.serialize(
      object.reduceOnly,
      specifiedType: const FullType(bool),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    OpenOrderDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required OpenOrderDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'orderId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.orderId = valueDes;
          break;
        case r'coin':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.coin = valueDes;
          break;
        case r'side':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(OpenOrderDtoSideEnum),
          ) as OpenOrderDtoSideEnum;
          result.side = valueDes;
          break;
        case r'type':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.type = valueDes;
          break;
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
        case r'origSize':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.origSize = valueDes;
          break;
        case r'value':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.value = valueDes;
          break;
        case r'timestamp':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.timestamp = valueDes;
          break;
        case r'triggerPrice':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.triggerPrice = valueDes;
          break;
        case r'triggerCondition':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.triggerCondition = valueDes;
          break;
        case r'reduceOnly':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.reduceOnly = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  OpenOrderDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = OpenOrderDtoBuilder();
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

class OpenOrderDtoSideEnum extends EnumClass {

  /// 订单方向
  @BuiltValueEnumConst(wireName: r'BUY')
  static const OpenOrderDtoSideEnum BUY = _$openOrderDtoSideEnum_BUY;
  /// 订单方向
  @BuiltValueEnumConst(wireName: r'SELL')
  static const OpenOrderDtoSideEnum SELL = _$openOrderDtoSideEnum_SELL;

  static Serializer<OpenOrderDtoSideEnum> get serializer => _$openOrderDtoSideEnumSerializer;

  const OpenOrderDtoSideEnum._(String name): super(name);

  static BuiltSet<OpenOrderDtoSideEnum> get values => _$openOrderDtoSideEnumValues;
  static OpenOrderDtoSideEnum valueOf(String name) => _$openOrderDtoSideEnumValueOf(name);
}

