//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'whale_asset_performance_dto.g.dart';

/// WhaleAssetPerformanceDto
///
/// Properties:
/// * [symbol] - 币种符号
/// * [totalValueUsd] - 该币种在时间窗口内的累计名义价值（USD），基于 Hyperliquid Whale Alert 中的 positionValueUsd 聚合
/// * [trades] - 该币种在时间窗口内的鲸鱼预警条数（视作成交/开平仓次数的近似值）
/// * [longCount] - 多头方向的预警条数（positionSize > 0）
/// * [shortCount] - 空头方向的预警条数（positionSize < 0）
@BuiltValue()
abstract class WhaleAssetPerformanceDto implements Built<WhaleAssetPerformanceDto, WhaleAssetPerformanceDtoBuilder> {
  /// 币种符号
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  /// 该币种在时间窗口内的累计名义价值（USD），基于 Hyperliquid Whale Alert 中的 positionValueUsd 聚合
  @BuiltValueField(wireName: r'totalValueUsd')
  num get totalValueUsd;

  /// 该币种在时间窗口内的鲸鱼预警条数（视作成交/开平仓次数的近似值）
  @BuiltValueField(wireName: r'trades')
  num get trades;

  /// 多头方向的预警条数（positionSize > 0）
  @BuiltValueField(wireName: r'longCount')
  num get longCount;

  /// 空头方向的预警条数（positionSize < 0）
  @BuiltValueField(wireName: r'shortCount')
  num get shortCount;

  WhaleAssetPerformanceDto._();

  factory WhaleAssetPerformanceDto([void updates(WhaleAssetPerformanceDtoBuilder b)]) = _$WhaleAssetPerformanceDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(WhaleAssetPerformanceDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<WhaleAssetPerformanceDto> get serializer => _$WhaleAssetPerformanceDtoSerializer();
}

class _$WhaleAssetPerformanceDtoSerializer implements PrimitiveSerializer<WhaleAssetPerformanceDto> {
  @override
  final Iterable<Type> types = const [WhaleAssetPerformanceDto, _$WhaleAssetPerformanceDto];

  @override
  final String wireName = r'WhaleAssetPerformanceDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    WhaleAssetPerformanceDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'symbol';
    yield serializers.serialize(
      object.symbol,
      specifiedType: const FullType(String),
    );
    yield r'totalValueUsd';
    yield serializers.serialize(
      object.totalValueUsd,
      specifiedType: const FullType(num),
    );
    yield r'trades';
    yield serializers.serialize(
      object.trades,
      specifiedType: const FullType(num),
    );
    yield r'longCount';
    yield serializers.serialize(
      object.longCount,
      specifiedType: const FullType(num),
    );
    yield r'shortCount';
    yield serializers.serialize(
      object.shortCount,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    WhaleAssetPerformanceDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required WhaleAssetPerformanceDtoBuilder result,
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
        case r'totalValueUsd':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.totalValueUsd = valueDes;
          break;
        case r'trades':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.trades = valueDes;
          break;
        case r'longCount':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.longCount = valueDes;
          break;
        case r'shortCount':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.shortCount = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  WhaleAssetPerformanceDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = WhaleAssetPerformanceDtoBuilder();
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

