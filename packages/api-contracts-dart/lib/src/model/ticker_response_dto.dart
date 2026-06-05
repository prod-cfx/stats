//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'ticker_response_dto.g.dart';

/// TickerResponseDto
///
/// Properties:
/// * [symbol] - 币种符号
/// * [exchange] - 交易所名称（聚合数据时为空）
/// * [currentPrice] - 当前价格
/// * [indexPrice] - 指数价格
/// * [priceChangePercent24h] - 24小时价格变化百分比
/// * [volumeUsd] - 24小时成交量（USD）
/// * [openInterestUsd] - 持仓量（USD）
/// * [fundingRate] - 资金费率
/// * [nextFundingTime] - 下次资金费率时间（毫秒时间戳）
/// * [high24h] - 24小时最高价
/// * [low24h] - 24小时最低价
@BuiltValue()
abstract class TickerResponseDto implements Built<TickerResponseDto, TickerResponseDtoBuilder> {
  /// 币种符号
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  /// 交易所名称（聚合数据时为空）
  @BuiltValueField(wireName: r'exchange')
  String? get exchange;

  /// 当前价格
  @BuiltValueField(wireName: r'currentPrice')
  String get currentPrice;

  /// 指数价格
  @BuiltValueField(wireName: r'indexPrice')
  String? get indexPrice;

  /// 24小时价格变化百分比
  @BuiltValueField(wireName: r'priceChangePercent24h')
  String? get priceChangePercent24h;

  /// 24小时成交量（USD）
  @BuiltValueField(wireName: r'volumeUsd')
  String get volumeUsd;

  /// 持仓量（USD）
  @BuiltValueField(wireName: r'openInterestUsd')
  String? get openInterestUsd;

  /// 资金费率
  @BuiltValueField(wireName: r'fundingRate')
  String? get fundingRate;

  /// 下次资金费率时间（毫秒时间戳）
  @BuiltValueField(wireName: r'nextFundingTime')
  String? get nextFundingTime;

  /// 24小时最高价
  @BuiltValueField(wireName: r'high24h')
  String? get high24h;

  /// 24小时最低价
  @BuiltValueField(wireName: r'low24h')
  String? get low24h;

  TickerResponseDto._();

  factory TickerResponseDto([void updates(TickerResponseDtoBuilder b)]) = _$TickerResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(TickerResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<TickerResponseDto> get serializer => _$TickerResponseDtoSerializer();
}

class _$TickerResponseDtoSerializer implements PrimitiveSerializer<TickerResponseDto> {
  @override
  final Iterable<Type> types = const [TickerResponseDto, _$TickerResponseDto];

  @override
  final String wireName = r'TickerResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    TickerResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'symbol';
    yield serializers.serialize(
      object.symbol,
      specifiedType: const FullType(String),
    );
    if (object.exchange != null) {
      yield r'exchange';
      yield serializers.serialize(
        object.exchange,
        specifiedType: const FullType(String),
      );
    }
    yield r'currentPrice';
    yield serializers.serialize(
      object.currentPrice,
      specifiedType: const FullType(String),
    );
    if (object.indexPrice != null) {
      yield r'indexPrice';
      yield serializers.serialize(
        object.indexPrice,
        specifiedType: const FullType(String),
      );
    }
    if (object.priceChangePercent24h != null) {
      yield r'priceChangePercent24h';
      yield serializers.serialize(
        object.priceChangePercent24h,
        specifiedType: const FullType(String),
      );
    }
    yield r'volumeUsd';
    yield serializers.serialize(
      object.volumeUsd,
      specifiedType: const FullType(String),
    );
    if (object.openInterestUsd != null) {
      yield r'openInterestUsd';
      yield serializers.serialize(
        object.openInterestUsd,
        specifiedType: const FullType(String),
      );
    }
    if (object.fundingRate != null) {
      yield r'fundingRate';
      yield serializers.serialize(
        object.fundingRate,
        specifiedType: const FullType(String),
      );
    }
    if (object.nextFundingTime != null) {
      yield r'nextFundingTime';
      yield serializers.serialize(
        object.nextFundingTime,
        specifiedType: const FullType(String),
      );
    }
    if (object.high24h != null) {
      yield r'high24h';
      yield serializers.serialize(
        object.high24h,
        specifiedType: const FullType(String),
      );
    }
    if (object.low24h != null) {
      yield r'low24h';
      yield serializers.serialize(
        object.low24h,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    TickerResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required TickerResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'symbol':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.symbol = valueDes;
          break;
        case r'exchange':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.exchange = valueDes;
          break;
        case r'currentPrice':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.currentPrice = valueDes;
          break;
        case r'indexPrice':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.indexPrice = valueDes;
          break;
        case r'priceChangePercent24h':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.priceChangePercent24h = valueDes;
          break;
        case r'volumeUsd':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.volumeUsd = valueDes;
          break;
        case r'openInterestUsd':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.openInterestUsd = valueDes;
          break;
        case r'fundingRate':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.fundingRate = valueDes;
          break;
        case r'nextFundingTime':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.nextFundingTime = valueDes;
          break;
        case r'high24h':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.high24h = valueDes;
          break;
        case r'low24h':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.low24h = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  TickerResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = TickerResponseDtoBuilder();
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

