//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/whale_asset_performance_dto.dart';
import 'package:backend_api_contracts/src/model/whale_trade_history_item_dto.dart';
import 'package:backend_api_contracts/src/model/whale_trader_summary_performance_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'whale_address_performance_response_dto.g.dart';

/// WhaleAddressPerformanceResponseDto
///
/// Properties:
/// * [summary] - 地址级别的汇总绩效信息
/// * [byAsset] - 按币种聚合的绩效列表
/// * [trades] - 按时间倒序排列的鲸鱼预警明细列表，可视作该地址在选定时间窗口内的“历史交易”近似记录
@BuiltValue()
abstract class WhaleAddressPerformanceResponseDto implements Built<WhaleAddressPerformanceResponseDto, WhaleAddressPerformanceResponseDtoBuilder> {
  /// 地址级别的汇总绩效信息
  @BuiltValueField(wireName: r'summary')
  WhaleTraderSummaryPerformanceDto get summary;

  /// 按币种聚合的绩效列表
  @BuiltValueField(wireName: r'byAsset')
  BuiltList<WhaleAssetPerformanceDto> get byAsset;

  /// 按时间倒序排列的鲸鱼预警明细列表，可视作该地址在选定时间窗口内的“历史交易”近似记录
  @BuiltValueField(wireName: r'trades')
  BuiltList<WhaleTradeHistoryItemDto> get trades;

  WhaleAddressPerformanceResponseDto._();

  factory WhaleAddressPerformanceResponseDto([void updates(WhaleAddressPerformanceResponseDtoBuilder b)]) = _$WhaleAddressPerformanceResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(WhaleAddressPerformanceResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<WhaleAddressPerformanceResponseDto> get serializer => _$WhaleAddressPerformanceResponseDtoSerializer();
}

class _$WhaleAddressPerformanceResponseDtoSerializer implements PrimitiveSerializer<WhaleAddressPerformanceResponseDto> {
  @override
  final Iterable<Type> types = const [WhaleAddressPerformanceResponseDto, _$WhaleAddressPerformanceResponseDto];

  @override
  final String wireName = r'WhaleAddressPerformanceResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    WhaleAddressPerformanceResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'summary';
    yield serializers.serialize(
      object.summary,
      specifiedType: const FullType(WhaleTraderSummaryPerformanceDto),
    );
    yield r'byAsset';
    yield serializers.serialize(
      object.byAsset,
      specifiedType: const FullType(BuiltList, [FullType(WhaleAssetPerformanceDto)]),
    );
    yield r'trades';
    yield serializers.serialize(
      object.trades,
      specifiedType: const FullType(BuiltList, [FullType(WhaleTradeHistoryItemDto)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    WhaleAddressPerformanceResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required WhaleAddressPerformanceResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'summary':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(WhaleTraderSummaryPerformanceDto),
          ) as WhaleTraderSummaryPerformanceDto;
          result.summary.replace(valueDes);
          break;
        case r'byAsset':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(WhaleAssetPerformanceDto)]),
          ) as BuiltList<WhaleAssetPerformanceDto>;
          result.byAsset.replace(valueDes);
          break;
        case r'trades':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(WhaleTradeHistoryItemDto)]),
          ) as BuiltList<WhaleTradeHistoryItemDto>;
          result.trades.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  WhaleAddressPerformanceResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = WhaleAddressPerformanceResponseDtoBuilder();
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

