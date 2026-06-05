//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'whale_trade_history_item_dto.g.dart';

/// WhaleTradeHistoryItemDto
///
/// Properties:
/// * [address] - 鲸鱼地址（用户地址）
/// * [symbol] - 币种符号，如 BTC / ETH
/// * [side] - 仓位方向，多头 LONG / 空头 SHORT，根据 positionSize 正负推导
/// * [positionSize] - 持仓大小（原始数值，正数=多头，负数=空头）
/// * [positionValueUsd] - 持仓名义价值（USD）
/// * [entryPrice] - 入场价格
/// * [liquidationPrice] - 清算价格
/// * [positionAction] - 持仓操作类型：1 = 开仓, 2 = 平仓（直接来自 Hyperliquid Whale Alert 数据）
/// * [createTime] - 该持仓变动时间（来自 create_time）
@BuiltValue()
abstract class WhaleTradeHistoryItemDto implements Built<WhaleTradeHistoryItemDto, WhaleTradeHistoryItemDtoBuilder> {
  /// 鲸鱼地址（用户地址）
  @BuiltValueField(wireName: r'address')
  String get address;

  /// 币种符号，如 BTC / ETH
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  /// 仓位方向，多头 LONG / 空头 SHORT，根据 positionSize 正负推导
  @BuiltValueField(wireName: r'side')
  WhaleTradeHistoryItemDtoSideEnum get side;
  // enum sideEnum {  LONG,  SHORT,  };

  /// 持仓大小（原始数值，正数=多头，负数=空头）
  @BuiltValueField(wireName: r'positionSize')
  num get positionSize;

  /// 持仓名义价值（USD）
  @BuiltValueField(wireName: r'positionValueUsd')
  num get positionValueUsd;

  /// 入场价格
  @BuiltValueField(wireName: r'entryPrice')
  num get entryPrice;

  /// 清算价格
  @BuiltValueField(wireName: r'liquidationPrice')
  num get liquidationPrice;

  /// 持仓操作类型：1 = 开仓, 2 = 平仓（直接来自 Hyperliquid Whale Alert 数据）
  @BuiltValueField(wireName: r'positionAction')
  WhaleTradeHistoryItemDtoPositionActionEnum get positionAction;
  // enum positionActionEnum {  1,  2,  };

  /// 该持仓变动时间（来自 create_time）
  @BuiltValueField(wireName: r'createTime')
  String get createTime;

  WhaleTradeHistoryItemDto._();

  factory WhaleTradeHistoryItemDto([void updates(WhaleTradeHistoryItemDtoBuilder b)]) = _$WhaleTradeHistoryItemDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(WhaleTradeHistoryItemDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<WhaleTradeHistoryItemDto> get serializer => _$WhaleTradeHistoryItemDtoSerializer();
}

class _$WhaleTradeHistoryItemDtoSerializer implements PrimitiveSerializer<WhaleTradeHistoryItemDto> {
  @override
  final Iterable<Type> types = const [WhaleTradeHistoryItemDto, _$WhaleTradeHistoryItemDto];

  @override
  final String wireName = r'WhaleTradeHistoryItemDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    WhaleTradeHistoryItemDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'address';
    yield serializers.serialize(
      object.address,
      specifiedType: const FullType(String),
    );
    yield r'symbol';
    yield serializers.serialize(
      object.symbol,
      specifiedType: const FullType(String),
    );
    yield r'side';
    yield serializers.serialize(
      object.side,
      specifiedType: const FullType(WhaleTradeHistoryItemDtoSideEnum),
    );
    yield r'positionSize';
    yield serializers.serialize(
      object.positionSize,
      specifiedType: const FullType(num),
    );
    yield r'positionValueUsd';
    yield serializers.serialize(
      object.positionValueUsd,
      specifiedType: const FullType(num),
    );
    yield r'entryPrice';
    yield serializers.serialize(
      object.entryPrice,
      specifiedType: const FullType(num),
    );
    yield r'liquidationPrice';
    yield serializers.serialize(
      object.liquidationPrice,
      specifiedType: const FullType(num),
    );
    yield r'positionAction';
    yield serializers.serialize(
      object.positionAction,
      specifiedType: const FullType(WhaleTradeHistoryItemDtoPositionActionEnum),
    );
    yield r'createTime';
    yield serializers.serialize(
      object.createTime,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    WhaleTradeHistoryItemDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required WhaleTradeHistoryItemDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'address':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.address = valueDes;
          break;
        case r'symbol':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.symbol = valueDes;
          break;
        case r'side':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(WhaleTradeHistoryItemDtoSideEnum),
          ) as WhaleTradeHistoryItemDtoSideEnum;
          result.side = valueDes;
          break;
        case r'positionSize':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.positionSize = valueDes;
          break;
        case r'positionValueUsd':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.positionValueUsd = valueDes;
          break;
        case r'entryPrice':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.entryPrice = valueDes;
          break;
        case r'liquidationPrice':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.liquidationPrice = valueDes;
          break;
        case r'positionAction':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(WhaleTradeHistoryItemDtoPositionActionEnum),
          ) as WhaleTradeHistoryItemDtoPositionActionEnum;
          result.positionAction = valueDes;
          break;
        case r'createTime':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.createTime = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  WhaleTradeHistoryItemDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = WhaleTradeHistoryItemDtoBuilder();
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

class WhaleTradeHistoryItemDtoSideEnum extends EnumClass {

  /// 仓位方向，多头 LONG / 空头 SHORT，根据 positionSize 正负推导
  @BuiltValueEnumConst(wireName: r'LONG')
  static const WhaleTradeHistoryItemDtoSideEnum LONG = _$whaleTradeHistoryItemDtoSideEnum_LONG;
  /// 仓位方向，多头 LONG / 空头 SHORT，根据 positionSize 正负推导
  @BuiltValueEnumConst(wireName: r'SHORT')
  static const WhaleTradeHistoryItemDtoSideEnum SHORT = _$whaleTradeHistoryItemDtoSideEnum_SHORT;

  static Serializer<WhaleTradeHistoryItemDtoSideEnum> get serializer => _$whaleTradeHistoryItemDtoSideEnumSerializer;

  const WhaleTradeHistoryItemDtoSideEnum._(String name): super(name);

  static BuiltSet<WhaleTradeHistoryItemDtoSideEnum> get values => _$whaleTradeHistoryItemDtoSideEnumValues;
  static WhaleTradeHistoryItemDtoSideEnum valueOf(String name) => _$whaleTradeHistoryItemDtoSideEnumValueOf(name);
}

class WhaleTradeHistoryItemDtoPositionActionEnum extends EnumClass {

  /// 持仓操作类型：1 = 开仓, 2 = 平仓（直接来自 Hyperliquid Whale Alert 数据）
  @BuiltValueEnumConst(wireName: r'1')
  static const WhaleTradeHistoryItemDtoPositionActionEnum n1 = _$whaleTradeHistoryItemDtoPositionActionEnum_n1;
  /// 持仓操作类型：1 = 开仓, 2 = 平仓（直接来自 Hyperliquid Whale Alert 数据）
  @BuiltValueEnumConst(wireName: r'2')
  static const WhaleTradeHistoryItemDtoPositionActionEnum n2 = _$whaleTradeHistoryItemDtoPositionActionEnum_n2;

  static Serializer<WhaleTradeHistoryItemDtoPositionActionEnum> get serializer => _$whaleTradeHistoryItemDtoPositionActionEnumSerializer;

  const WhaleTradeHistoryItemDtoPositionActionEnum._(String name): super(name);

  static BuiltSet<WhaleTradeHistoryItemDtoPositionActionEnum> get values => _$whaleTradeHistoryItemDtoPositionActionEnumValues;
  static WhaleTradeHistoryItemDtoPositionActionEnum valueOf(String name) => _$whaleTradeHistoryItemDtoPositionActionEnumValueOf(name);
}

