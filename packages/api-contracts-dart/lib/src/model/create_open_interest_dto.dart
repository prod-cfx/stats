//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'create_open_interest_dto.g.dart';

/// CreateOpenInterestDto
///
/// Properties:
/// * [exchange] - 交易所名称，\"All\"表示所有交易所汇总
/// * [symbol] - 币种符号
/// * [openInterestUsd] - 未平仓合约价值(USD)
/// * [openInterestQuantity] - 未平仓合约数量
/// * [openInterestByStableCoinMargin] - 稳定币本位未平仓合约价值(USD)
/// * [openInterestByCoinMargin] - 币本位未平仓合约价值(USD)
/// * [openInterestQuantityByCoinMargin] - 币本位未平仓合约数量
/// * [openInterestQuantityByStableCoinMargin] - 稳定币本位未平仓合约数量
/// * [openInterestChangePercent5m] - 5分钟内未平仓合约变化百分比
/// * [openInterestChangePercent15m] - 15分钟内未平仓合约变化百分比
/// * [openInterestChangePercent30m] - 30分钟内未平仓合约变化百分比
/// * [openInterestChangePercent1h] - 1小时内未平仓合约变化百分比
/// * [openInterestChangePercent4h] - 4小时内未平仓合约变化百分比
/// * [openInterestChangePercent24h] - 24小时内未平仓合约变化百分比
/// * [dataTimestamp] - 数据时间戳（必填）
@BuiltValue()
abstract class CreateOpenInterestDto implements Built<CreateOpenInterestDto, CreateOpenInterestDtoBuilder> {
  /// 交易所名称，\"All\"表示所有交易所汇总
  @BuiltValueField(wireName: r'exchange')
  String get exchange;

  /// 币种符号
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  /// 未平仓合约价值(USD)
  @BuiltValueField(wireName: r'open_interest_usd')
  num get openInterestUsd;

  /// 未平仓合约数量
  @BuiltValueField(wireName: r'open_interest_quantity')
  num get openInterestQuantity;

  /// 稳定币本位未平仓合约价值(USD)
  @BuiltValueField(wireName: r'open_interest_by_stable_coin_margin')
  num? get openInterestByStableCoinMargin;

  /// 币本位未平仓合约价值(USD)
  @BuiltValueField(wireName: r'open_interest_by_coin_margin')
  num? get openInterestByCoinMargin;

  /// 币本位未平仓合约数量
  @BuiltValueField(wireName: r'open_interest_quantity_by_coin_margin')
  num? get openInterestQuantityByCoinMargin;

  /// 稳定币本位未平仓合约数量
  @BuiltValueField(wireName: r'open_interest_quantity_by_stable_coin_margin')
  num? get openInterestQuantityByStableCoinMargin;

  /// 5分钟内未平仓合约变化百分比
  @BuiltValueField(wireName: r'open_interest_change_percent_5m')
  num? get openInterestChangePercent5m;

  /// 15分钟内未平仓合约变化百分比
  @BuiltValueField(wireName: r'open_interest_change_percent_15m')
  num? get openInterestChangePercent15m;

  /// 30分钟内未平仓合约变化百分比
  @BuiltValueField(wireName: r'open_interest_change_percent_30m')
  num? get openInterestChangePercent30m;

  /// 1小时内未平仓合约变化百分比
  @BuiltValueField(wireName: r'open_interest_change_percent_1h')
  num? get openInterestChangePercent1h;

  /// 4小时内未平仓合约变化百分比
  @BuiltValueField(wireName: r'open_interest_change_percent_4h')
  num? get openInterestChangePercent4h;

  /// 24小时内未平仓合约变化百分比
  @BuiltValueField(wireName: r'open_interest_change_percent_24h')
  num? get openInterestChangePercent24h;

  /// 数据时间戳（必填）
  @BuiltValueField(wireName: r'data_timestamp')
  String get dataTimestamp;

  CreateOpenInterestDto._();

  factory CreateOpenInterestDto([void updates(CreateOpenInterestDtoBuilder b)]) = _$CreateOpenInterestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CreateOpenInterestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<CreateOpenInterestDto> get serializer => _$CreateOpenInterestDtoSerializer();
}

class _$CreateOpenInterestDtoSerializer implements PrimitiveSerializer<CreateOpenInterestDto> {
  @override
  final Iterable<Type> types = const [CreateOpenInterestDto, _$CreateOpenInterestDto];

  @override
  final String wireName = r'CreateOpenInterestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CreateOpenInterestDto object, {
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
    yield r'open_interest_usd';
    yield serializers.serialize(
      object.openInterestUsd,
      specifiedType: const FullType(num),
    );
    yield r'open_interest_quantity';
    yield serializers.serialize(
      object.openInterestQuantity,
      specifiedType: const FullType(num),
    );
    if (object.openInterestByStableCoinMargin != null) {
      yield r'open_interest_by_stable_coin_margin';
      yield serializers.serialize(
        object.openInterestByStableCoinMargin,
        specifiedType: const FullType(num),
      );
    }
    if (object.openInterestByCoinMargin != null) {
      yield r'open_interest_by_coin_margin';
      yield serializers.serialize(
        object.openInterestByCoinMargin,
        specifiedType: const FullType(num),
      );
    }
    if (object.openInterestQuantityByCoinMargin != null) {
      yield r'open_interest_quantity_by_coin_margin';
      yield serializers.serialize(
        object.openInterestQuantityByCoinMargin,
        specifiedType: const FullType(num),
      );
    }
    if (object.openInterestQuantityByStableCoinMargin != null) {
      yield r'open_interest_quantity_by_stable_coin_margin';
      yield serializers.serialize(
        object.openInterestQuantityByStableCoinMargin,
        specifiedType: const FullType(num),
      );
    }
    if (object.openInterestChangePercent5m != null) {
      yield r'open_interest_change_percent_5m';
      yield serializers.serialize(
        object.openInterestChangePercent5m,
        specifiedType: const FullType(num),
      );
    }
    if (object.openInterestChangePercent15m != null) {
      yield r'open_interest_change_percent_15m';
      yield serializers.serialize(
        object.openInterestChangePercent15m,
        specifiedType: const FullType(num),
      );
    }
    if (object.openInterestChangePercent30m != null) {
      yield r'open_interest_change_percent_30m';
      yield serializers.serialize(
        object.openInterestChangePercent30m,
        specifiedType: const FullType(num),
      );
    }
    if (object.openInterestChangePercent1h != null) {
      yield r'open_interest_change_percent_1h';
      yield serializers.serialize(
        object.openInterestChangePercent1h,
        specifiedType: const FullType(num),
      );
    }
    if (object.openInterestChangePercent4h != null) {
      yield r'open_interest_change_percent_4h';
      yield serializers.serialize(
        object.openInterestChangePercent4h,
        specifiedType: const FullType(num),
      );
    }
    if (object.openInterestChangePercent24h != null) {
      yield r'open_interest_change_percent_24h';
      yield serializers.serialize(
        object.openInterestChangePercent24h,
        specifiedType: const FullType(num),
      );
    }
    yield r'data_timestamp';
    yield serializers.serialize(
      object.dataTimestamp,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    CreateOpenInterestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CreateOpenInterestDtoBuilder result,
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
        case r'open_interest_usd':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.openInterestUsd = valueDes;
          break;
        case r'open_interest_quantity':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.openInterestQuantity = valueDes;
          break;
        case r'open_interest_by_stable_coin_margin':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.openInterestByStableCoinMargin = valueDes;
          break;
        case r'open_interest_by_coin_margin':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.openInterestByCoinMargin = valueDes;
          break;
        case r'open_interest_quantity_by_coin_margin':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.openInterestQuantityByCoinMargin = valueDes;
          break;
        case r'open_interest_quantity_by_stable_coin_margin':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.openInterestQuantityByStableCoinMargin = valueDes;
          break;
        case r'open_interest_change_percent_5m':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.openInterestChangePercent5m = valueDes;
          break;
        case r'open_interest_change_percent_15m':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.openInterestChangePercent15m = valueDes;
          break;
        case r'open_interest_change_percent_30m':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.openInterestChangePercent30m = valueDes;
          break;
        case r'open_interest_change_percent_1h':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.openInterestChangePercent1h = valueDes;
          break;
        case r'open_interest_change_percent_4h':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.openInterestChangePercent4h = valueDes;
          break;
        case r'open_interest_change_percent_24h':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.openInterestChangePercent24h = valueDes;
          break;
        case r'data_timestamp':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.dataTimestamp = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  CreateOpenInterestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CreateOpenInterestDtoBuilder();
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

