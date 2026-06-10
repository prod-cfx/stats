//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/liquidation_heatmap_response_dto_price_candlesticks_inner_inner.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'liquidation_heatmap_response_dto.g.dart';

/// LiquidationHeatmapResponseDto
///
/// Properties:
/// * [snapshotId] - 快照 ID
/// * [symbol] - 基础标的，例如 BTC
/// * [exchangeCode] - 交易所代码，例如 BINANCE
/// * [tradingPair] - 完整交易对，例如 BTC/USDT
/// * [contractType] - 合约类型，例如 PERPETUAL
/// * [modelType] - Heatmap 模型类型
/// * [timeInterval] - 时间粒度，例如 15m/1h
/// * [valueCurrency] - 数值币种，默认为 USD
/// * [fetchedAt] - 拉取时间
/// * [effectiveFrom] - 数据生效起始时间
/// * [effectiveTo] - 数据生效结束时间
/// * [yAxis] - Y 轴价格刻度列表
/// * [liquidationLeverageData] - 清算热力值，[xIndex, yIndex, value] 三元组数组
/// * [priceCandlesticks] - 价格 K 线数据，[timestamp(sec), open, high, low, close, volume] 六元组数组，价格与成交量为字符串形式
@BuiltValue()
abstract class LiquidationHeatmapResponseDto implements Built<LiquidationHeatmapResponseDto, LiquidationHeatmapResponseDtoBuilder> {
  /// 快照 ID
  @BuiltValueField(wireName: r'snapshotId')
  num get snapshotId;

  /// 基础标的，例如 BTC
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  /// 交易所代码，例如 BINANCE
  @BuiltValueField(wireName: r'exchangeCode')
  String? get exchangeCode;

  /// 完整交易对，例如 BTC/USDT
  @BuiltValueField(wireName: r'tradingPair')
  String? get tradingPair;

  /// 合约类型，例如 PERPETUAL
  @BuiltValueField(wireName: r'contractType')
  String? get contractType;

  /// Heatmap 模型类型
  @BuiltValueField(wireName: r'modelType')
  LiquidationHeatmapResponseDtoModelTypeEnum get modelType;
  // enum modelTypeEnum {  MODEL1,  MODEL2,  MODEL3,  };

  /// 时间粒度，例如 15m/1h
  @BuiltValueField(wireName: r'timeInterval')
  String? get timeInterval;

  /// 数值币种，默认为 USD
  @BuiltValueField(wireName: r'valueCurrency')
  String get valueCurrency;

  /// 拉取时间
  @BuiltValueField(wireName: r'fetchedAt')
  DateTime get fetchedAt;

  /// 数据生效起始时间
  @BuiltValueField(wireName: r'effectiveFrom')
  DateTime? get effectiveFrom;

  /// 数据生效结束时间
  @BuiltValueField(wireName: r'effectiveTo')
  DateTime? get effectiveTo;

  /// Y 轴价格刻度列表
  @BuiltValueField(wireName: r'y_axis')
  BuiltList<num> get yAxis;

  /// 清算热力值，[xIndex, yIndex, value] 三元组数组
  @BuiltValueField(wireName: r'liquidation_leverage_data')
  BuiltList<BuiltList<num>> get liquidationLeverageData;

  /// 价格 K 线数据，[timestamp(sec), open, high, low, close, volume] 六元组数组，价格与成交量为字符串形式
  @BuiltValueField(wireName: r'price_candlesticks')
  BuiltList<BuiltList<LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner>> get priceCandlesticks;

  LiquidationHeatmapResponseDto._();

  factory LiquidationHeatmapResponseDto([void updates(LiquidationHeatmapResponseDtoBuilder b)]) = _$LiquidationHeatmapResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(LiquidationHeatmapResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<LiquidationHeatmapResponseDto> get serializer => _$LiquidationHeatmapResponseDtoSerializer();
}

class _$LiquidationHeatmapResponseDtoSerializer implements PrimitiveSerializer<LiquidationHeatmapResponseDto> {
  @override
  final Iterable<Type> types = const [LiquidationHeatmapResponseDto, _$LiquidationHeatmapResponseDto];

  @override
  final String wireName = r'LiquidationHeatmapResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    LiquidationHeatmapResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'snapshotId';
    yield serializers.serialize(
      object.snapshotId,
      specifiedType: const FullType(num),
    );
    yield r'symbol';
    yield serializers.serialize(
      object.symbol,
      specifiedType: const FullType(String),
    );
    yield r'exchangeCode';
    yield object.exchangeCode == null ? null : serializers.serialize(
      object.exchangeCode,
      specifiedType: const FullType.nullable(String),
    );
    yield r'tradingPair';
    yield object.tradingPair == null ? null : serializers.serialize(
      object.tradingPair,
      specifiedType: const FullType.nullable(String),
    );
    yield r'contractType';
    yield object.contractType == null ? null : serializers.serialize(
      object.contractType,
      specifiedType: const FullType.nullable(String),
    );
    yield r'modelType';
    yield serializers.serialize(
      object.modelType,
      specifiedType: const FullType(LiquidationHeatmapResponseDtoModelTypeEnum),
    );
    yield r'timeInterval';
    yield object.timeInterval == null ? null : serializers.serialize(
      object.timeInterval,
      specifiedType: const FullType.nullable(String),
    );
    yield r'valueCurrency';
    yield serializers.serialize(
      object.valueCurrency,
      specifiedType: const FullType(String),
    );
    yield r'fetchedAt';
    yield serializers.serialize(
      object.fetchedAt,
      specifiedType: const FullType(DateTime),
    );
    yield r'effectiveFrom';
    yield object.effectiveFrom == null ? null : serializers.serialize(
      object.effectiveFrom,
      specifiedType: const FullType.nullable(DateTime),
    );
    yield r'effectiveTo';
    yield object.effectiveTo == null ? null : serializers.serialize(
      object.effectiveTo,
      specifiedType: const FullType.nullable(DateTime),
    );
    yield r'y_axis';
    yield serializers.serialize(
      object.yAxis,
      specifiedType: const FullType(BuiltList, [FullType(num)]),
    );
    yield r'liquidation_leverage_data';
    yield serializers.serialize(
      object.liquidationLeverageData,
      specifiedType: const FullType(BuiltList, [FullType(BuiltList, [FullType(num)])]),
    );
    yield r'price_candlesticks';
    yield serializers.serialize(
      object.priceCandlesticks,
      specifiedType: const FullType(BuiltList, [FullType(BuiltList, [FullType(LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner)])]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    LiquidationHeatmapResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required LiquidationHeatmapResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'snapshotId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.snapshotId = valueDes;
          break;
        case r'symbol':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.symbol = valueDes;
          break;
        case r'exchangeCode':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.exchangeCode = valueDes;
          break;
        case r'tradingPair':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.tradingPair = valueDes;
          break;
        case r'contractType':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.contractType = valueDes;
          break;
        case r'modelType':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(LiquidationHeatmapResponseDtoModelTypeEnum),
          ) as LiquidationHeatmapResponseDtoModelTypeEnum;
          result.modelType = valueDes;
          break;
        case r'timeInterval':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.timeInterval = valueDes;
          break;
        case r'valueCurrency':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.valueCurrency = valueDes;
          break;
        case r'fetchedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.fetchedAt = valueDes;
          break;
        case r'effectiveFrom':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(DateTime),
          ) as DateTime?;
          if (valueDes == null) continue;
          result.effectiveFrom = valueDes;
          break;
        case r'effectiveTo':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(DateTime),
          ) as DateTime?;
          if (valueDes == null) continue;
          result.effectiveTo = valueDes;
          break;
        case r'y_axis':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(num)]),
          ) as BuiltList<num>;
          result.yAxis.replace(valueDes);
          break;
        case r'liquidation_leverage_data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(BuiltList, [FullType(num)])]),
          ) as BuiltList<BuiltList<num>>;
          result.liquidationLeverageData.replace(valueDes);
          break;
        case r'price_candlesticks':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(BuiltList, [FullType(LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner)])]),
          ) as BuiltList<BuiltList<LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner>>;
          result.priceCandlesticks.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  LiquidationHeatmapResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = LiquidationHeatmapResponseDtoBuilder();
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

class LiquidationHeatmapResponseDtoModelTypeEnum extends EnumClass {

  /// Heatmap 模型类型
  @BuiltValueEnumConst(wireName: r'MODEL1')
  static const LiquidationHeatmapResponseDtoModelTypeEnum MODEL1 = _$liquidationHeatmapResponseDtoModelTypeEnum_MODEL1;
  /// Heatmap 模型类型
  @BuiltValueEnumConst(wireName: r'MODEL2')
  static const LiquidationHeatmapResponseDtoModelTypeEnum MODEL2 = _$liquidationHeatmapResponseDtoModelTypeEnum_MODEL2;
  /// Heatmap 模型类型
  @BuiltValueEnumConst(wireName: r'MODEL3')
  static const LiquidationHeatmapResponseDtoModelTypeEnum MODEL3 = _$liquidationHeatmapResponseDtoModelTypeEnum_MODEL3;

  static Serializer<LiquidationHeatmapResponseDtoModelTypeEnum> get serializer => _$liquidationHeatmapResponseDtoModelTypeEnumSerializer;

  const LiquidationHeatmapResponseDtoModelTypeEnum._(String name): super(name);

  static BuiltSet<LiquidationHeatmapResponseDtoModelTypeEnum> get values => _$liquidationHeatmapResponseDtoModelTypeEnumValues;
  static LiquidationHeatmapResponseDtoModelTypeEnum valueOf(String name) => _$liquidationHeatmapResponseDtoModelTypeEnumValueOf(name);
}

