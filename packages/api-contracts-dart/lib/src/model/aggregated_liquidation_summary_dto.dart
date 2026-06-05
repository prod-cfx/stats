//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/liquidation_summary_item_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'aggregated_liquidation_summary_dto.g.dart';

/// AggregatedLiquidationSummaryDto
///
/// Properties:
/// * [symbol] - 币种基础资产，例如 BTC / ETH
/// * [items] - 不同时间区间的爆仓汇总数据
@BuiltValue()
abstract class AggregatedLiquidationSummaryDto implements Built<AggregatedLiquidationSummaryDto, AggregatedLiquidationSummaryDtoBuilder> {
  /// 币种基础资产，例如 BTC / ETH
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  /// 不同时间区间的爆仓汇总数据
  @BuiltValueField(wireName: r'items')
  BuiltList<LiquidationSummaryItemDto> get items;

  AggregatedLiquidationSummaryDto._();

  factory AggregatedLiquidationSummaryDto([void updates(AggregatedLiquidationSummaryDtoBuilder b)]) = _$AggregatedLiquidationSummaryDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AggregatedLiquidationSummaryDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AggregatedLiquidationSummaryDto> get serializer => _$AggregatedLiquidationSummaryDtoSerializer();
}

class _$AggregatedLiquidationSummaryDtoSerializer implements PrimitiveSerializer<AggregatedLiquidationSummaryDto> {
  @override
  final Iterable<Type> types = const [AggregatedLiquidationSummaryDto, _$AggregatedLiquidationSummaryDto];

  @override
  final String wireName = r'AggregatedLiquidationSummaryDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AggregatedLiquidationSummaryDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'symbol';
    yield serializers.serialize(
      object.symbol,
      specifiedType: const FullType(String),
    );
    yield r'items';
    yield serializers.serialize(
      object.items,
      specifiedType: const FullType(BuiltList, [FullType(LiquidationSummaryItemDto)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AggregatedLiquidationSummaryDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AggregatedLiquidationSummaryDtoBuilder result,
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
        case r'items':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(LiquidationSummaryItemDto)]),
          ) as BuiltList<LiquidationSummaryItemDto>;
          result.items.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AggregatedLiquidationSummaryDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AggregatedLiquidationSummaryDtoBuilder();
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

