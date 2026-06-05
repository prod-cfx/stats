//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/order_book_level_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'venue_order_book_dto.g.dart';

/// VenueOrderBookDto
///
/// Properties:
/// * [venueId] - 流动性来源唯一标识，例如 binance-spot、okx-spot 等
/// * [marketKey] - 内部统一市场标识，格式如 BTC-USDT:spot / BTC-USDT:perp
/// * [bids] - 买盘深度（按价格从高到低排序）
/// * [asks] - 卖盘深度（按价格从低到高排序）
/// * [exchangeTs] - 交易所侧事件时间戳（毫秒），如有
/// * [receivedTs] - 本地接收时间戳（毫秒）
/// * [version] - 本地版本号 / 序列号，用于去重与连续性检查
@BuiltValue()
abstract class VenueOrderBookDto implements Built<VenueOrderBookDto, VenueOrderBookDtoBuilder> {
  /// 流动性来源唯一标识，例如 binance-spot、okx-spot 等
  @BuiltValueField(wireName: r'venueId')
  String get venueId;

  /// 内部统一市场标识，格式如 BTC-USDT:spot / BTC-USDT:perp
  @BuiltValueField(wireName: r'marketKey')
  String get marketKey;

  /// 买盘深度（按价格从高到低排序）
  @BuiltValueField(wireName: r'bids')
  BuiltList<OrderBookLevelDto> get bids;

  /// 卖盘深度（按价格从低到高排序）
  @BuiltValueField(wireName: r'asks')
  BuiltList<OrderBookLevelDto> get asks;

  /// 交易所侧事件时间戳（毫秒），如有
  @BuiltValueField(wireName: r'exchangeTs')
  num? get exchangeTs;

  /// 本地接收时间戳（毫秒）
  @BuiltValueField(wireName: r'receivedTs')
  num get receivedTs;

  /// 本地版本号 / 序列号，用于去重与连续性检查
  @BuiltValueField(wireName: r'version')
  num get version;

  VenueOrderBookDto._();

  factory VenueOrderBookDto([void updates(VenueOrderBookDtoBuilder b)]) = _$VenueOrderBookDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(VenueOrderBookDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<VenueOrderBookDto> get serializer => _$VenueOrderBookDtoSerializer();
}

class _$VenueOrderBookDtoSerializer implements PrimitiveSerializer<VenueOrderBookDto> {
  @override
  final Iterable<Type> types = const [VenueOrderBookDto, _$VenueOrderBookDto];

  @override
  final String wireName = r'VenueOrderBookDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    VenueOrderBookDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'venueId';
    yield serializers.serialize(
      object.venueId,
      specifiedType: const FullType(String),
    );
    yield r'marketKey';
    yield serializers.serialize(
      object.marketKey,
      specifiedType: const FullType(String),
    );
    yield r'bids';
    yield serializers.serialize(
      object.bids,
      specifiedType: const FullType(BuiltList, [FullType(OrderBookLevelDto)]),
    );
    yield r'asks';
    yield serializers.serialize(
      object.asks,
      specifiedType: const FullType(BuiltList, [FullType(OrderBookLevelDto)]),
    );
    if (object.exchangeTs != null) {
      yield r'exchangeTs';
      yield serializers.serialize(
        object.exchangeTs,
        specifiedType: const FullType.nullable(num),
      );
    }
    yield r'receivedTs';
    yield serializers.serialize(
      object.receivedTs,
      specifiedType: const FullType(num),
    );
    yield r'version';
    yield serializers.serialize(
      object.version,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    VenueOrderBookDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required VenueOrderBookDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'venueId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.venueId = valueDes;
          break;
        case r'marketKey':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.marketKey = valueDes;
          break;
        case r'bids':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(OrderBookLevelDto)]),
          ) as BuiltList<OrderBookLevelDto>;
          result.bids.replace(valueDes);
          break;
        case r'asks':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(OrderBookLevelDto)]),
          ) as BuiltList<OrderBookLevelDto>;
          result.asks.replace(valueDes);
          break;
        case r'exchangeTs':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(num),
          ) as num?;
          if (valueDes == null) continue;
          result.exchangeTs = valueDes;
          break;
        case r'receivedTs':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.receivedTs = valueDes;
          break;
        case r'version':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.version = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  VenueOrderBookDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = VenueOrderBookDtoBuilder();
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

