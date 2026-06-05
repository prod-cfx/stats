//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'long_short_ratio_point_response_dto.g.dart';

/// LongShortRatioPointResponseDto
///
/// Properties:
/// * [tradingPairId] - 交易对唯一 ID（TradingPairConfig.id）
/// * [interval] - 时间粒度，可选值：1m / 5m / 15m / 1h / 4h / 1d
/// * [timestamp] - 时间戳（ISO 字符串），通常为该时间粒度区间的起始时间
/// * [longShortRatio] - 多空比（多/空），字符串形式返回以避免精度丢失
/// * [longAccountRatio] - 多头账户占比，字符串形式返回
/// * [shortAccountRatio] - 空头账户占比，字符串形式返回
/// * [longVolume] - 多头仓位名义价值 / 数量，字符串形式返回
/// * [shortVolume] - 空头仓位名义价值 / 数量，字符串形式返回
/// * [longShortAccountRatio] - 账户多空比，字符串形式返回
/// * [source_] - 数据来源，例如 COINGLASS
@BuiltValue()
abstract class LongShortRatioPointResponseDto implements Built<LongShortRatioPointResponseDto, LongShortRatioPointResponseDtoBuilder> {
  /// 交易对唯一 ID（TradingPairConfig.id）
  @BuiltValueField(wireName: r'tradingPairId')
  String get tradingPairId;

  /// 时间粒度，可选值：1m / 5m / 15m / 1h / 4h / 1d
  @BuiltValueField(wireName: r'interval')
  LongShortRatioPointResponseDtoIntervalEnum get interval;
  // enum intervalEnum {  1m,  3m,  5m,  15m,  30m,  1h,  4h,  6h,  8h,  12h,  1d,  1w,  };

  /// 时间戳（ISO 字符串），通常为该时间粒度区间的起始时间
  @BuiltValueField(wireName: r'timestamp')
  String get timestamp;

  /// 多空比（多/空），字符串形式返回以避免精度丢失
  @BuiltValueField(wireName: r'longShortRatio')
  String get longShortRatio;

  /// 多头账户占比，字符串形式返回
  @BuiltValueField(wireName: r'longAccountRatio')
  String? get longAccountRatio;

  /// 空头账户占比，字符串形式返回
  @BuiltValueField(wireName: r'shortAccountRatio')
  String? get shortAccountRatio;

  /// 多头仓位名义价值 / 数量，字符串形式返回
  @BuiltValueField(wireName: r'longVolume')
  String? get longVolume;

  /// 空头仓位名义价值 / 数量，字符串形式返回
  @BuiltValueField(wireName: r'shortVolume')
  String? get shortVolume;

  /// 账户多空比，字符串形式返回
  @BuiltValueField(wireName: r'longShortAccountRatio')
  String? get longShortAccountRatio;

  /// 数据来源，例如 COINGLASS
  @BuiltValueField(wireName: r'source')
  String get source_;

  LongShortRatioPointResponseDto._();

  factory LongShortRatioPointResponseDto([void updates(LongShortRatioPointResponseDtoBuilder b)]) = _$LongShortRatioPointResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(LongShortRatioPointResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<LongShortRatioPointResponseDto> get serializer => _$LongShortRatioPointResponseDtoSerializer();
}

class _$LongShortRatioPointResponseDtoSerializer implements PrimitiveSerializer<LongShortRatioPointResponseDto> {
  @override
  final Iterable<Type> types = const [LongShortRatioPointResponseDto, _$LongShortRatioPointResponseDto];

  @override
  final String wireName = r'LongShortRatioPointResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    LongShortRatioPointResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'tradingPairId';
    yield serializers.serialize(
      object.tradingPairId,
      specifiedType: const FullType(String),
    );
    yield r'interval';
    yield serializers.serialize(
      object.interval,
      specifiedType: const FullType(LongShortRatioPointResponseDtoIntervalEnum),
    );
    yield r'timestamp';
    yield serializers.serialize(
      object.timestamp,
      specifiedType: const FullType(String),
    );
    yield r'longShortRatio';
    yield serializers.serialize(
      object.longShortRatio,
      specifiedType: const FullType(String),
    );
    if (object.longAccountRatio != null) {
      yield r'longAccountRatio';
      yield serializers.serialize(
        object.longAccountRatio,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.shortAccountRatio != null) {
      yield r'shortAccountRatio';
      yield serializers.serialize(
        object.shortAccountRatio,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.longVolume != null) {
      yield r'longVolume';
      yield serializers.serialize(
        object.longVolume,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.shortVolume != null) {
      yield r'shortVolume';
      yield serializers.serialize(
        object.shortVolume,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.longShortAccountRatio != null) {
      yield r'longShortAccountRatio';
      yield serializers.serialize(
        object.longShortAccountRatio,
        specifiedType: const FullType.nullable(String),
      );
    }
    yield r'source';
    yield serializers.serialize(
      object.source_,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    LongShortRatioPointResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required LongShortRatioPointResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'tradingPairId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.tradingPairId = valueDes;
          break;
        case r'interval':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(LongShortRatioPointResponseDtoIntervalEnum),
          ) as LongShortRatioPointResponseDtoIntervalEnum;
          result.interval = valueDes;
          break;
        case r'timestamp':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.timestamp = valueDes;
          break;
        case r'longShortRatio':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.longShortRatio = valueDes;
          break;
        case r'longAccountRatio':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.longAccountRatio = valueDes;
          break;
        case r'shortAccountRatio':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.shortAccountRatio = valueDes;
          break;
        case r'longVolume':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.longVolume = valueDes;
          break;
        case r'shortVolume':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.shortVolume = valueDes;
          break;
        case r'longShortAccountRatio':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.longShortAccountRatio = valueDes;
          break;
        case r'source':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.source_ = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  LongShortRatioPointResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = LongShortRatioPointResponseDtoBuilder();
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

class LongShortRatioPointResponseDtoIntervalEnum extends EnumClass {

  /// 时间粒度，可选值：1m / 5m / 15m / 1h / 4h / 1d
  @BuiltValueEnumConst(wireName: r'1m')
  static const LongShortRatioPointResponseDtoIntervalEnum n1m = _$longShortRatioPointResponseDtoIntervalEnum_n1m;
  /// 时间粒度，可选值：1m / 5m / 15m / 1h / 4h / 1d
  @BuiltValueEnumConst(wireName: r'3m')
  static const LongShortRatioPointResponseDtoIntervalEnum n3m = _$longShortRatioPointResponseDtoIntervalEnum_n3m;
  /// 时间粒度，可选值：1m / 5m / 15m / 1h / 4h / 1d
  @BuiltValueEnumConst(wireName: r'5m')
  static const LongShortRatioPointResponseDtoIntervalEnum n5m = _$longShortRatioPointResponseDtoIntervalEnum_n5m;
  /// 时间粒度，可选值：1m / 5m / 15m / 1h / 4h / 1d
  @BuiltValueEnumConst(wireName: r'15m')
  static const LongShortRatioPointResponseDtoIntervalEnum n15m = _$longShortRatioPointResponseDtoIntervalEnum_n15m;
  /// 时间粒度，可选值：1m / 5m / 15m / 1h / 4h / 1d
  @BuiltValueEnumConst(wireName: r'30m')
  static const LongShortRatioPointResponseDtoIntervalEnum n30m = _$longShortRatioPointResponseDtoIntervalEnum_n30m;
  /// 时间粒度，可选值：1m / 5m / 15m / 1h / 4h / 1d
  @BuiltValueEnumConst(wireName: r'1h')
  static const LongShortRatioPointResponseDtoIntervalEnum n1h = _$longShortRatioPointResponseDtoIntervalEnum_n1h;
  /// 时间粒度，可选值：1m / 5m / 15m / 1h / 4h / 1d
  @BuiltValueEnumConst(wireName: r'4h')
  static const LongShortRatioPointResponseDtoIntervalEnum n4h = _$longShortRatioPointResponseDtoIntervalEnum_n4h;
  /// 时间粒度，可选值：1m / 5m / 15m / 1h / 4h / 1d
  @BuiltValueEnumConst(wireName: r'6h')
  static const LongShortRatioPointResponseDtoIntervalEnum n6h = _$longShortRatioPointResponseDtoIntervalEnum_n6h;
  /// 时间粒度，可选值：1m / 5m / 15m / 1h / 4h / 1d
  @BuiltValueEnumConst(wireName: r'8h')
  static const LongShortRatioPointResponseDtoIntervalEnum n8h = _$longShortRatioPointResponseDtoIntervalEnum_n8h;
  /// 时间粒度，可选值：1m / 5m / 15m / 1h / 4h / 1d
  @BuiltValueEnumConst(wireName: r'12h')
  static const LongShortRatioPointResponseDtoIntervalEnum n12h = _$longShortRatioPointResponseDtoIntervalEnum_n12h;
  /// 时间粒度，可选值：1m / 5m / 15m / 1h / 4h / 1d
  @BuiltValueEnumConst(wireName: r'1d')
  static const LongShortRatioPointResponseDtoIntervalEnum n1d = _$longShortRatioPointResponseDtoIntervalEnum_n1d;
  /// 时间粒度，可选值：1m / 5m / 15m / 1h / 4h / 1d
  @BuiltValueEnumConst(wireName: r'1w')
  static const LongShortRatioPointResponseDtoIntervalEnum n1w = _$longShortRatioPointResponseDtoIntervalEnum_n1w;

  static Serializer<LongShortRatioPointResponseDtoIntervalEnum> get serializer => _$longShortRatioPointResponseDtoIntervalEnumSerializer;

  const LongShortRatioPointResponseDtoIntervalEnum._(String name): super(name);

  static BuiltSet<LongShortRatioPointResponseDtoIntervalEnum> get values => _$longShortRatioPointResponseDtoIntervalEnumValues;
  static LongShortRatioPointResponseDtoIntervalEnum valueOf(String name) => _$longShortRatioPointResponseDtoIntervalEnumValueOf(name);
}

