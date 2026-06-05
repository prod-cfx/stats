//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'exchange_long_short_ratio_response_dto.g.dart';

/// ExchangeLongShortRatioResponseDto
///
/// Properties:
/// * [rank] - 交易所排名（按总持仓金额从高到低排序，从 1 开始）
/// * [name] - 交易所名称，例如 Binance / OKX / Bybit / DEX
/// * [logoUrl] - 交易所 Logo URL，可选
/// * [longPercent] - 做多账户或持仓占比（百分比，0-100）
/// * [shortPercent] - 做空账户或持仓占比（百分比，0-100）
/// * [longAmountUsd] - 做多名义持仓金额（USD）
/// * [shortAmountUsd] - 做空名义持仓金额（USD）
@BuiltValue()
abstract class ExchangeLongShortRatioResponseDto implements Built<ExchangeLongShortRatioResponseDto, ExchangeLongShortRatioResponseDtoBuilder> {
  /// 交易所排名（按总持仓金额从高到低排序，从 1 开始）
  @BuiltValueField(wireName: r'rank')
  num get rank;

  /// 交易所名称，例如 Binance / OKX / Bybit / DEX
  @BuiltValueField(wireName: r'name')
  String get name;

  /// 交易所 Logo URL，可选
  @BuiltValueField(wireName: r'logoUrl')
  String? get logoUrl;

  /// 做多账户或持仓占比（百分比，0-100）
  @BuiltValueField(wireName: r'longPercent')
  num get longPercent;

  /// 做空账户或持仓占比（百分比，0-100）
  @BuiltValueField(wireName: r'shortPercent')
  num get shortPercent;

  /// 做多名义持仓金额（USD）
  @BuiltValueField(wireName: r'longAmountUsd')
  num get longAmountUsd;

  /// 做空名义持仓金额（USD）
  @BuiltValueField(wireName: r'shortAmountUsd')
  num get shortAmountUsd;

  ExchangeLongShortRatioResponseDto._();

  factory ExchangeLongShortRatioResponseDto([void updates(ExchangeLongShortRatioResponseDtoBuilder b)]) = _$ExchangeLongShortRatioResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(ExchangeLongShortRatioResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<ExchangeLongShortRatioResponseDto> get serializer => _$ExchangeLongShortRatioResponseDtoSerializer();
}

class _$ExchangeLongShortRatioResponseDtoSerializer implements PrimitiveSerializer<ExchangeLongShortRatioResponseDto> {
  @override
  final Iterable<Type> types = const [ExchangeLongShortRatioResponseDto, _$ExchangeLongShortRatioResponseDto];

  @override
  final String wireName = r'ExchangeLongShortRatioResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    ExchangeLongShortRatioResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'rank';
    yield serializers.serialize(
      object.rank,
      specifiedType: const FullType(num),
    );
    yield r'name';
    yield serializers.serialize(
      object.name,
      specifiedType: const FullType(String),
    );
    if (object.logoUrl != null) {
      yield r'logoUrl';
      yield serializers.serialize(
        object.logoUrl,
        specifiedType: const FullType(String),
      );
    }
    yield r'longPercent';
    yield serializers.serialize(
      object.longPercent,
      specifiedType: const FullType(num),
    );
    yield r'shortPercent';
    yield serializers.serialize(
      object.shortPercent,
      specifiedType: const FullType(num),
    );
    yield r'longAmountUsd';
    yield serializers.serialize(
      object.longAmountUsd,
      specifiedType: const FullType(num),
    );
    yield r'shortAmountUsd';
    yield serializers.serialize(
      object.shortAmountUsd,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    ExchangeLongShortRatioResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required ExchangeLongShortRatioResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'rank':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.rank = valueDes;
          break;
        case r'name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.name = valueDes;
          break;
        case r'logoUrl':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.logoUrl = valueDes;
          break;
        case r'longPercent':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.longPercent = valueDes;
          break;
        case r'shortPercent':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.shortPercent = valueDes;
          break;
        case r'longAmountUsd':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.longAmountUsd = valueDes;
          break;
        case r'shortAmountUsd':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.shortAmountUsd = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  ExchangeLongShortRatioResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = ExchangeLongShortRatioResponseDtoBuilder();
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

