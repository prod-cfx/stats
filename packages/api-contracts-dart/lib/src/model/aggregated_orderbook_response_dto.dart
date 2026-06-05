//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/aggregated_level_dto.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'aggregated_orderbook_response_dto.g.dart';

/// AggregatedOrderbookResponseDto
///
/// Properties:
/// * [marketKey] - 市场标识
/// * [base_] - 基础资产
/// * [type] - 市场类型
/// * [asks] - 聚合卖单 (价格从低到高)
/// * [bids] - 聚合买单 (价格从高到低)
/// * [midPrice] - 中间价
/// * [updatedAt] - 更新时间戳
/// * [venues] - 返回数据的交易所列表
/// * [mergedQuotes] - 合并的计价资产
@BuiltValue()
abstract class AggregatedOrderbookResponseDto implements Built<AggregatedOrderbookResponseDto, AggregatedOrderbookResponseDtoBuilder> {
  /// 市场标识
  @BuiltValueField(wireName: r'marketKey')
  String get marketKey;

  /// 基础资产
  @BuiltValueField(wireName: r'base')
  String get base_;

  /// 市场类型
  @BuiltValueField(wireName: r'type')
  String get type;

  /// 聚合卖单 (价格从低到高)
  @BuiltValueField(wireName: r'asks')
  BuiltList<AggregatedLevelDto> get asks;

  /// 聚合买单 (价格从高到低)
  @BuiltValueField(wireName: r'bids')
  BuiltList<AggregatedLevelDto> get bids;

  /// 中间价
  @BuiltValueField(wireName: r'midPrice')
  num get midPrice;

  /// 更新时间戳
  @BuiltValueField(wireName: r'updatedAt')
  num get updatedAt;

  /// 返回数据的交易所列表
  @BuiltValueField(wireName: r'venues')
  BuiltList<String> get venues;

  /// 合并的计价资产
  @BuiltValueField(wireName: r'mergedQuotes')
  BuiltList<String> get mergedQuotes;

  AggregatedOrderbookResponseDto._();

  factory AggregatedOrderbookResponseDto([void updates(AggregatedOrderbookResponseDtoBuilder b)]) = _$AggregatedOrderbookResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AggregatedOrderbookResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AggregatedOrderbookResponseDto> get serializer => _$AggregatedOrderbookResponseDtoSerializer();
}

class _$AggregatedOrderbookResponseDtoSerializer implements PrimitiveSerializer<AggregatedOrderbookResponseDto> {
  @override
  final Iterable<Type> types = const [AggregatedOrderbookResponseDto, _$AggregatedOrderbookResponseDto];

  @override
  final String wireName = r'AggregatedOrderbookResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AggregatedOrderbookResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'marketKey';
    yield serializers.serialize(
      object.marketKey,
      specifiedType: const FullType(String),
    );
    yield r'base';
    yield serializers.serialize(
      object.base_,
      specifiedType: const FullType(String),
    );
    yield r'type';
    yield serializers.serialize(
      object.type,
      specifiedType: const FullType(String),
    );
    yield r'asks';
    yield serializers.serialize(
      object.asks,
      specifiedType: const FullType(BuiltList, [FullType(AggregatedLevelDto)]),
    );
    yield r'bids';
    yield serializers.serialize(
      object.bids,
      specifiedType: const FullType(BuiltList, [FullType(AggregatedLevelDto)]),
    );
    yield r'midPrice';
    yield serializers.serialize(
      object.midPrice,
      specifiedType: const FullType(num),
    );
    yield r'updatedAt';
    yield serializers.serialize(
      object.updatedAt,
      specifiedType: const FullType(num),
    );
    yield r'venues';
    yield serializers.serialize(
      object.venues,
      specifiedType: const FullType(BuiltList, [FullType(String)]),
    );
    yield r'mergedQuotes';
    yield serializers.serialize(
      object.mergedQuotes,
      specifiedType: const FullType(BuiltList, [FullType(String)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AggregatedOrderbookResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AggregatedOrderbookResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'marketKey':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.marketKey = valueDes;
          break;
        case r'base':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.base_ = valueDes;
          break;
        case r'type':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.type = valueDes;
          break;
        case r'asks':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(AggregatedLevelDto)]),
          ) as BuiltList<AggregatedLevelDto>;
          result.asks.replace(valueDes);
          break;
        case r'bids':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(AggregatedLevelDto)]),
          ) as BuiltList<AggregatedLevelDto>;
          result.bids.replace(valueDes);
          break;
        case r'midPrice':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.midPrice = valueDes;
          break;
        case r'updatedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.updatedAt = valueDes;
          break;
        case r'venues':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.venues.replace(valueDes);
          break;
        case r'mergedQuotes':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.mergedQuotes.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AggregatedOrderbookResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AggregatedOrderbookResponseDtoBuilder();
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

