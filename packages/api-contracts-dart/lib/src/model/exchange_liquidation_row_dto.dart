//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'exchange_liquidation_row_dto.g.dart';

/// ExchangeLiquidationRowDto
///
/// Properties:
/// * [exchange] - 交易所代码或名称，例如 BINANCE / OKX / AGGREGATED / TOTAL
/// * [symbol] - 币种基础资产，例如 BTC / ETH / ALL
/// * [timeframe] - 时间区间（粒度），与 Coinglass interval 对齐，例如 1h/4h/12h/24h
/// * [amountUsd] - 该交易所该时间区间内的总爆仓金额（USD），long + short
/// * [longUsd] - 多头爆仓金额（USD）
/// * [shortUsd] - 空头爆仓金额（USD）
/// * [longShare] - 多头占比（0-1），= longUsd / amountUsd
/// * [isTotal] - 是否为 TOTAL 汇总行
@BuiltValue()
abstract class ExchangeLiquidationRowDto implements Built<ExchangeLiquidationRowDto, ExchangeLiquidationRowDtoBuilder> {
  /// 交易所代码或名称，例如 BINANCE / OKX / AGGREGATED / TOTAL
  @BuiltValueField(wireName: r'exchange')
  String get exchange;

  /// 币种基础资产，例如 BTC / ETH / ALL
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  /// 时间区间（粒度），与 Coinglass interval 对齐，例如 1h/4h/12h/24h
  @BuiltValueField(wireName: r'timeframe')
  ExchangeLiquidationRowDtoTimeframeEnum get timeframe;
  // enum timeframeEnum {  1h,  4h,  12h,  24h,  };

  /// 该交易所该时间区间内的总爆仓金额（USD），long + short
  @BuiltValueField(wireName: r'amountUsd')
  num get amountUsd;

  /// 多头爆仓金额（USD）
  @BuiltValueField(wireName: r'longUsd')
  num get longUsd;

  /// 空头爆仓金额（USD）
  @BuiltValueField(wireName: r'shortUsd')
  num get shortUsd;

  /// 多头占比（0-1），= longUsd / amountUsd
  @BuiltValueField(wireName: r'longShare')
  num? get longShare;

  /// 是否为 TOTAL 汇总行
  @BuiltValueField(wireName: r'isTotal')
  bool? get isTotal;

  ExchangeLiquidationRowDto._();

  factory ExchangeLiquidationRowDto([void updates(ExchangeLiquidationRowDtoBuilder b)]) = _$ExchangeLiquidationRowDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(ExchangeLiquidationRowDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<ExchangeLiquidationRowDto> get serializer => _$ExchangeLiquidationRowDtoSerializer();
}

class _$ExchangeLiquidationRowDtoSerializer implements PrimitiveSerializer<ExchangeLiquidationRowDto> {
  @override
  final Iterable<Type> types = const [ExchangeLiquidationRowDto, _$ExchangeLiquidationRowDto];

  @override
  final String wireName = r'ExchangeLiquidationRowDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    ExchangeLiquidationRowDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'exchange';
    yield serializers.serialize(
      object.exchange,
      specifiedType: const FullType(String),
    );
    yield r'symbol';
    yield serializers.serialize(
      object.symbol,
      specifiedType: const FullType(String),
    );
    yield r'timeframe';
    yield serializers.serialize(
      object.timeframe,
      specifiedType: const FullType(ExchangeLiquidationRowDtoTimeframeEnum),
    );
    yield r'amountUsd';
    yield serializers.serialize(
      object.amountUsd,
      specifiedType: const FullType(num),
    );
    yield r'longUsd';
    yield serializers.serialize(
      object.longUsd,
      specifiedType: const FullType(num),
    );
    yield r'shortUsd';
    yield serializers.serialize(
      object.shortUsd,
      specifiedType: const FullType(num),
    );
    if (object.longShare != null) {
      yield r'longShare';
      yield serializers.serialize(
        object.longShare,
        specifiedType: const FullType(num),
      );
    }
    if (object.isTotal != null) {
      yield r'isTotal';
      yield serializers.serialize(
        object.isTotal,
        specifiedType: const FullType(bool),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    ExchangeLiquidationRowDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required ExchangeLiquidationRowDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'exchange':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.exchange = valueDes;
          break;
        case r'symbol':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.symbol = valueDes;
          break;
        case r'timeframe':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(ExchangeLiquidationRowDtoTimeframeEnum),
          ) as ExchangeLiquidationRowDtoTimeframeEnum;
          result.timeframe = valueDes;
          break;
        case r'amountUsd':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.amountUsd = valueDes;
          break;
        case r'longUsd':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.longUsd = valueDes;
          break;
        case r'shortUsd':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.shortUsd = valueDes;
          break;
        case r'longShare':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.longShare = valueDes;
          break;
        case r'isTotal':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.isTotal = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  ExchangeLiquidationRowDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = ExchangeLiquidationRowDtoBuilder();
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

class ExchangeLiquidationRowDtoTimeframeEnum extends EnumClass {

  /// 时间区间（粒度），与 Coinglass interval 对齐，例如 1h/4h/12h/24h
  @BuiltValueEnumConst(wireName: r'1h')
  static const ExchangeLiquidationRowDtoTimeframeEnum n1h = _$exchangeLiquidationRowDtoTimeframeEnum_n1h;
  /// 时间区间（粒度），与 Coinglass interval 对齐，例如 1h/4h/12h/24h
  @BuiltValueEnumConst(wireName: r'4h')
  static const ExchangeLiquidationRowDtoTimeframeEnum n4h = _$exchangeLiquidationRowDtoTimeframeEnum_n4h;
  /// 时间区间（粒度），与 Coinglass interval 对齐，例如 1h/4h/12h/24h
  @BuiltValueEnumConst(wireName: r'12h')
  static const ExchangeLiquidationRowDtoTimeframeEnum n12h = _$exchangeLiquidationRowDtoTimeframeEnum_n12h;
  /// 时间区间（粒度），与 Coinglass interval 对齐，例如 1h/4h/12h/24h
  @BuiltValueEnumConst(wireName: r'24h')
  static const ExchangeLiquidationRowDtoTimeframeEnum n24h = _$exchangeLiquidationRowDtoTimeframeEnum_n24h;

  static Serializer<ExchangeLiquidationRowDtoTimeframeEnum> get serializer => _$exchangeLiquidationRowDtoTimeframeEnumSerializer;

  const ExchangeLiquidationRowDtoTimeframeEnum._(String name): super(name);

  static BuiltSet<ExchangeLiquidationRowDtoTimeframeEnum> get values => _$exchangeLiquidationRowDtoTimeframeEnumValues;
  static ExchangeLiquidationRowDtoTimeframeEnum valueOf(String name) => _$exchangeLiquidationRowDtoTimeframeEnumValueOf(name);
}

