//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'ai_quant_conversation_backtest_execution_response_dto.g.dart';

/// AiQuantConversationBacktestExecutionResponseDto
///
/// Properties:
/// * [initialCash] - 初始资金
/// * [leverage] - 杠杆倍数（现货为 null）
/// * [slippageBps] - 滑点（基点 bps）
/// * [feeBps] - 手续费（基点 bps）
/// * [priceSource] - 成交参考价来源
/// * [allowPartial] - 是否允许部分数据回测
@BuiltValue()
abstract class AiQuantConversationBacktestExecutionResponseDto implements Built<AiQuantConversationBacktestExecutionResponseDto, AiQuantConversationBacktestExecutionResponseDtoBuilder> {
  /// 初始资金
  @BuiltValueField(wireName: r'initialCash')
  num get initialCash;

  /// 杠杆倍数（现货为 null）
  @BuiltValueField(wireName: r'leverage')
  num? get leverage;

  /// 滑点（基点 bps）
  @BuiltValueField(wireName: r'slippageBps')
  num get slippageBps;

  /// 手续费（基点 bps）
  @BuiltValueField(wireName: r'feeBps')
  num get feeBps;

  /// 成交参考价来源
  @BuiltValueField(wireName: r'priceSource')
  AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum get priceSource;
  // enum priceSourceEnum {  open,  close,  mid,  };

  /// 是否允许部分数据回测
  @BuiltValueField(wireName: r'allowPartial')
  bool get allowPartial;

  AiQuantConversationBacktestExecutionResponseDto._();

  factory AiQuantConversationBacktestExecutionResponseDto([void updates(AiQuantConversationBacktestExecutionResponseDtoBuilder b)]) = _$AiQuantConversationBacktestExecutionResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AiQuantConversationBacktestExecutionResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AiQuantConversationBacktestExecutionResponseDto> get serializer => _$AiQuantConversationBacktestExecutionResponseDtoSerializer();
}

class _$AiQuantConversationBacktestExecutionResponseDtoSerializer implements PrimitiveSerializer<AiQuantConversationBacktestExecutionResponseDto> {
  @override
  final Iterable<Type> types = const [AiQuantConversationBacktestExecutionResponseDto, _$AiQuantConversationBacktestExecutionResponseDto];

  @override
  final String wireName = r'AiQuantConversationBacktestExecutionResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AiQuantConversationBacktestExecutionResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'initialCash';
    yield serializers.serialize(
      object.initialCash,
      specifiedType: const FullType(num),
    );
    if (object.leverage != null) {
      yield r'leverage';
      yield serializers.serialize(
        object.leverage,
        specifiedType: const FullType.nullable(num),
      );
    }
    yield r'slippageBps';
    yield serializers.serialize(
      object.slippageBps,
      specifiedType: const FullType(num),
    );
    yield r'feeBps';
    yield serializers.serialize(
      object.feeBps,
      specifiedType: const FullType(num),
    );
    yield r'priceSource';
    yield serializers.serialize(
      object.priceSource,
      specifiedType: const FullType(AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum),
    );
    yield r'allowPartial';
    yield serializers.serialize(
      object.allowPartial,
      specifiedType: const FullType(bool),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AiQuantConversationBacktestExecutionResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AiQuantConversationBacktestExecutionResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'initialCash':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.initialCash = valueDes;
          break;
        case r'leverage':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(num),
          ) as num?;
          if (valueDes == null) continue;
          result.leverage = valueDes;
          break;
        case r'slippageBps':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.slippageBps = valueDes;
          break;
        case r'feeBps':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.feeBps = valueDes;
          break;
        case r'priceSource':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum),
          ) as AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum;
          result.priceSource = valueDes;
          break;
        case r'allowPartial':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.allowPartial = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AiQuantConversationBacktestExecutionResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AiQuantConversationBacktestExecutionResponseDtoBuilder();
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

class AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum extends EnumClass {

  /// 成交参考价来源
  @BuiltValueEnumConst(wireName: r'open')
  static const AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum open = _$aiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum_open;
  /// 成交参考价来源
  @BuiltValueEnumConst(wireName: r'close')
  static const AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum close = _$aiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum_close;
  /// 成交参考价来源
  @BuiltValueEnumConst(wireName: r'mid')
  static const AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum mid = _$aiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum_mid;

  static Serializer<AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum> get serializer => _$aiQuantConversationBacktestExecutionResponseDtoPriceSourceEnumSerializer;

  const AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum._(String name): super(name);

  static BuiltSet<AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum> get values => _$aiQuantConversationBacktestExecutionResponseDtoPriceSourceEnumValues;
  static AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum valueOf(String name) => _$aiQuantConversationBacktestExecutionResponseDtoPriceSourceEnumValueOf(name);
}

