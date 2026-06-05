//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'ai_quant_conversation_last_backtest_summary_response_dto.g.dart';

/// AiQuantConversationLastBacktestSummaryResponseDto
///
/// Properties:
/// * [maxDrawdownPct] 
/// * [totalReturnPct] 
/// * [winRatePct] 
/// * [tradeCount] 
/// * [openTradeCount] 
/// * [openPnl] 
/// * [marketType] 
@BuiltValue()
abstract class AiQuantConversationLastBacktestSummaryResponseDto implements Built<AiQuantConversationLastBacktestSummaryResponseDto, AiQuantConversationLastBacktestSummaryResponseDtoBuilder> {
  @BuiltValueField(wireName: r'maxDrawdownPct')
  num get maxDrawdownPct;

  @BuiltValueField(wireName: r'totalReturnPct')
  num get totalReturnPct;

  @BuiltValueField(wireName: r'winRatePct')
  num get winRatePct;

  @BuiltValueField(wireName: r'tradeCount')
  num get tradeCount;

  @BuiltValueField(wireName: r'openTradeCount')
  num? get openTradeCount;

  @BuiltValueField(wireName: r'openPnl')
  num? get openPnl;

  @BuiltValueField(wireName: r'marketType')
  AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum? get marketType;
  // enum marketTypeEnum {  spot,  perp,  };

  AiQuantConversationLastBacktestSummaryResponseDto._();

  factory AiQuantConversationLastBacktestSummaryResponseDto([void updates(AiQuantConversationLastBacktestSummaryResponseDtoBuilder b)]) = _$AiQuantConversationLastBacktestSummaryResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AiQuantConversationLastBacktestSummaryResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AiQuantConversationLastBacktestSummaryResponseDto> get serializer => _$AiQuantConversationLastBacktestSummaryResponseDtoSerializer();
}

class _$AiQuantConversationLastBacktestSummaryResponseDtoSerializer implements PrimitiveSerializer<AiQuantConversationLastBacktestSummaryResponseDto> {
  @override
  final Iterable<Type> types = const [AiQuantConversationLastBacktestSummaryResponseDto, _$AiQuantConversationLastBacktestSummaryResponseDto];

  @override
  final String wireName = r'AiQuantConversationLastBacktestSummaryResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AiQuantConversationLastBacktestSummaryResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'maxDrawdownPct';
    yield serializers.serialize(
      object.maxDrawdownPct,
      specifiedType: const FullType(num),
    );
    yield r'totalReturnPct';
    yield serializers.serialize(
      object.totalReturnPct,
      specifiedType: const FullType(num),
    );
    yield r'winRatePct';
    yield serializers.serialize(
      object.winRatePct,
      specifiedType: const FullType(num),
    );
    yield r'tradeCount';
    yield serializers.serialize(
      object.tradeCount,
      specifiedType: const FullType(num),
    );
    if (object.openTradeCount != null) {
      yield r'openTradeCount';
      yield serializers.serialize(
        object.openTradeCount,
        specifiedType: const FullType(num),
      );
    }
    if (object.openPnl != null) {
      yield r'openPnl';
      yield serializers.serialize(
        object.openPnl,
        specifiedType: const FullType(num),
      );
    }
    if (object.marketType != null) {
      yield r'marketType';
      yield serializers.serialize(
        object.marketType,
        specifiedType: const FullType(AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    AiQuantConversationLastBacktestSummaryResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AiQuantConversationLastBacktestSummaryResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'maxDrawdownPct':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.maxDrawdownPct = valueDes;
          break;
        case r'totalReturnPct':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.totalReturnPct = valueDes;
          break;
        case r'winRatePct':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.winRatePct = valueDes;
          break;
        case r'tradeCount':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.tradeCount = valueDes;
          break;
        case r'openTradeCount':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.openTradeCount = valueDes;
          break;
        case r'openPnl':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.openPnl = valueDes;
          break;
        case r'marketType':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum),
          ) as AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum;
          result.marketType = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AiQuantConversationLastBacktestSummaryResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AiQuantConversationLastBacktestSummaryResponseDtoBuilder();
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

class AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'spot')
  static const AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum spot = _$aiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum_spot;
  @BuiltValueEnumConst(wireName: r'perp')
  static const AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum perp = _$aiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum_perp;

  static Serializer<AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum> get serializer => _$aiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnumSerializer;

  const AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum._(String name): super(name);

  static BuiltSet<AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum> get values => _$aiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnumValues;
  static AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum valueOf(String name) => _$aiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnumValueOf(name);
}

