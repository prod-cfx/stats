//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'whale_holding_dto.g.dart';

/// WhaleHoldingDto
///
/// Properties:
/// * [userAddress] - 鲸鱼地址（用户地址）
/// * [symbol] - 币种符号，如 BTC / ETH
/// * [side] - 仓位方向，多头 LONG / 空头 SHORT，根据 positionSize 正负推导
/// * [positionSize] - 持仓大小绝对值（方向由 side 字段表示）
/// * [positionValueUsd] - 持仓名义价值（USD）
/// * [entryPrice] - 入场价格
/// * [liquidationPrice] - 清算价格（可能为 null）
/// * [pnl] - 未实现盈亏（USD），来自 API 的 pnl 字段
/// * [roe] - 收益率（ROE），小数形式，如 0.05 表示 5%
/// * [leverage] - 杠杆倍数，如 10 表示 10x 杠杆
/// * [snapshotTime] - 数据快照时间
@BuiltValue()
abstract class WhaleHoldingDto implements Built<WhaleHoldingDto, WhaleHoldingDtoBuilder> {
  /// 鲸鱼地址（用户地址）
  @BuiltValueField(wireName: r'userAddress')
  String get userAddress;

  /// 币种符号，如 BTC / ETH
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  /// 仓位方向，多头 LONG / 空头 SHORT，根据 positionSize 正负推导
  @BuiltValueField(wireName: r'side')
  WhaleHoldingDtoSideEnum get side;
  // enum sideEnum {  LONG,  SHORT,  };

  /// 持仓大小绝对值（方向由 side 字段表示）
  @BuiltValueField(wireName: r'positionSize')
  num get positionSize;

  /// 持仓名义价值（USD）
  @BuiltValueField(wireName: r'positionValueUsd')
  num get positionValueUsd;

  /// 入场价格
  @BuiltValueField(wireName: r'entryPrice')
  num get entryPrice;

  /// 清算价格（可能为 null）
  @BuiltValueField(wireName: r'liquidationPrice')
  num? get liquidationPrice;

  /// 未实现盈亏（USD），来自 API 的 pnl 字段
  @BuiltValueField(wireName: r'pnl')
  num? get pnl;

  /// 收益率（ROE），小数形式，如 0.05 表示 5%
  @BuiltValueField(wireName: r'roe')
  num? get roe;

  /// 杠杆倍数，如 10 表示 10x 杠杆
  @BuiltValueField(wireName: r'leverage')
  num? get leverage;

  /// 数据快照时间
  @BuiltValueField(wireName: r'snapshotTime')
  String get snapshotTime;

  WhaleHoldingDto._();

  factory WhaleHoldingDto([void updates(WhaleHoldingDtoBuilder b)]) = _$WhaleHoldingDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(WhaleHoldingDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<WhaleHoldingDto> get serializer => _$WhaleHoldingDtoSerializer();
}

class _$WhaleHoldingDtoSerializer implements PrimitiveSerializer<WhaleHoldingDto> {
  @override
  final Iterable<Type> types = const [WhaleHoldingDto, _$WhaleHoldingDto];

  @override
  final String wireName = r'WhaleHoldingDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    WhaleHoldingDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'userAddress';
    yield serializers.serialize(
      object.userAddress,
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
      specifiedType: const FullType(WhaleHoldingDtoSideEnum),
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
    yield object.liquidationPrice == null ? null : serializers.serialize(
      object.liquidationPrice,
      specifiedType: const FullType.nullable(num),
    );
    yield r'pnl';
    yield object.pnl == null ? null : serializers.serialize(
      object.pnl,
      specifiedType: const FullType.nullable(num),
    );
    yield r'roe';
    yield object.roe == null ? null : serializers.serialize(
      object.roe,
      specifiedType: const FullType.nullable(num),
    );
    yield r'leverage';
    yield object.leverage == null ? null : serializers.serialize(
      object.leverage,
      specifiedType: const FullType.nullable(num),
    );
    yield r'snapshotTime';
    yield serializers.serialize(
      object.snapshotTime,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    WhaleHoldingDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required WhaleHoldingDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'userAddress':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.userAddress = valueDes;
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
            specifiedType: const FullType(WhaleHoldingDtoSideEnum),
          ) as WhaleHoldingDtoSideEnum;
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
            specifiedType: const FullType.nullable(num),
          ) as num?;
          if (valueDes == null) continue;
          result.liquidationPrice = valueDes;
          break;
        case r'pnl':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(num),
          ) as num?;
          if (valueDes == null) continue;
          result.pnl = valueDes;
          break;
        case r'roe':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(num),
          ) as num?;
          if (valueDes == null) continue;
          result.roe = valueDes;
          break;
        case r'leverage':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(num),
          ) as num?;
          if (valueDes == null) continue;
          result.leverage = valueDes;
          break;
        case r'snapshotTime':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.snapshotTime = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  WhaleHoldingDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = WhaleHoldingDtoBuilder();
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

class WhaleHoldingDtoSideEnum extends EnumClass {

  /// 仓位方向，多头 LONG / 空头 SHORT，根据 positionSize 正负推导
  @BuiltValueEnumConst(wireName: r'LONG')
  static const WhaleHoldingDtoSideEnum LONG = _$whaleHoldingDtoSideEnum_LONG;
  /// 仓位方向，多头 LONG / 空头 SHORT，根据 positionSize 正负推导
  @BuiltValueEnumConst(wireName: r'SHORT')
  static const WhaleHoldingDtoSideEnum SHORT = _$whaleHoldingDtoSideEnum_SHORT;

  static Serializer<WhaleHoldingDtoSideEnum> get serializer => _$whaleHoldingDtoSideEnumSerializer;

  const WhaleHoldingDtoSideEnum._(String name): super(name);

  static BuiltSet<WhaleHoldingDtoSideEnum> get values => _$whaleHoldingDtoSideEnumValues;
  static WhaleHoldingDtoSideEnum valueOf(String name) => _$whaleHoldingDtoSideEnumValueOf(name);
}

