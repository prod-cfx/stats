//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'ai_quant_conversation_backtest_range_response_dto.g.dart';

/// AiQuantConversationBacktestRangeResponseDto
///
/// Properties:
/// * [preset] - 回测区间预设
/// * [startAt] - 自定义区间开始时间（ISO 8601）
/// * [endAt] - 自定义区间结束时间（ISO 8601）
@BuiltValue()
abstract class AiQuantConversationBacktestRangeResponseDto implements Built<AiQuantConversationBacktestRangeResponseDto, AiQuantConversationBacktestRangeResponseDtoBuilder> {
  /// 回测区间预设
  @BuiltValueField(wireName: r'preset')
  AiQuantConversationBacktestRangeResponseDtoPresetEnum get preset;
  // enum presetEnum {  7D,  30D,  90D,  1Y,  CUSTOM,  };

  /// 自定义区间开始时间（ISO 8601）
  @BuiltValueField(wireName: r'startAt')
  String? get startAt;

  /// 自定义区间结束时间（ISO 8601）
  @BuiltValueField(wireName: r'endAt')
  String? get endAt;

  AiQuantConversationBacktestRangeResponseDto._();

  factory AiQuantConversationBacktestRangeResponseDto([void updates(AiQuantConversationBacktestRangeResponseDtoBuilder b)]) = _$AiQuantConversationBacktestRangeResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AiQuantConversationBacktestRangeResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AiQuantConversationBacktestRangeResponseDto> get serializer => _$AiQuantConversationBacktestRangeResponseDtoSerializer();
}

class _$AiQuantConversationBacktestRangeResponseDtoSerializer implements PrimitiveSerializer<AiQuantConversationBacktestRangeResponseDto> {
  @override
  final Iterable<Type> types = const [AiQuantConversationBacktestRangeResponseDto, _$AiQuantConversationBacktestRangeResponseDto];

  @override
  final String wireName = r'AiQuantConversationBacktestRangeResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AiQuantConversationBacktestRangeResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'preset';
    yield serializers.serialize(
      object.preset,
      specifiedType: const FullType(AiQuantConversationBacktestRangeResponseDtoPresetEnum),
    );
    if (object.startAt != null) {
      yield r'startAt';
      yield serializers.serialize(
        object.startAt,
        specifiedType: const FullType(String),
      );
    }
    if (object.endAt != null) {
      yield r'endAt';
      yield serializers.serialize(
        object.endAt,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    AiQuantConversationBacktestRangeResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AiQuantConversationBacktestRangeResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'preset':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AiQuantConversationBacktestRangeResponseDtoPresetEnum),
          ) as AiQuantConversationBacktestRangeResponseDtoPresetEnum;
          result.preset = valueDes;
          break;
        case r'startAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.startAt = valueDes;
          break;
        case r'endAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.endAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AiQuantConversationBacktestRangeResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AiQuantConversationBacktestRangeResponseDtoBuilder();
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

class AiQuantConversationBacktestRangeResponseDtoPresetEnum extends EnumClass {

  /// 回测区间预设
  @BuiltValueEnumConst(wireName: r'7D')
  static const AiQuantConversationBacktestRangeResponseDtoPresetEnum n7d = _$aiQuantConversationBacktestRangeResponseDtoPresetEnum_n7d;
  /// 回测区间预设
  @BuiltValueEnumConst(wireName: r'30D')
  static const AiQuantConversationBacktestRangeResponseDtoPresetEnum n30d = _$aiQuantConversationBacktestRangeResponseDtoPresetEnum_n30d;
  /// 回测区间预设
  @BuiltValueEnumConst(wireName: r'90D')
  static const AiQuantConversationBacktestRangeResponseDtoPresetEnum n90d = _$aiQuantConversationBacktestRangeResponseDtoPresetEnum_n90d;
  /// 回测区间预设
  @BuiltValueEnumConst(wireName: r'1Y')
  static const AiQuantConversationBacktestRangeResponseDtoPresetEnum n1y = _$aiQuantConversationBacktestRangeResponseDtoPresetEnum_n1y;
  /// 回测区间预设
  @BuiltValueEnumConst(wireName: r'CUSTOM')
  static const AiQuantConversationBacktestRangeResponseDtoPresetEnum CUSTOM = _$aiQuantConversationBacktestRangeResponseDtoPresetEnum_CUSTOM;

  static Serializer<AiQuantConversationBacktestRangeResponseDtoPresetEnum> get serializer => _$aiQuantConversationBacktestRangeResponseDtoPresetEnumSerializer;

  const AiQuantConversationBacktestRangeResponseDtoPresetEnum._(String name): super(name);

  static BuiltSet<AiQuantConversationBacktestRangeResponseDtoPresetEnum> get values => _$aiQuantConversationBacktestRangeResponseDtoPresetEnumValues;
  static AiQuantConversationBacktestRangeResponseDtoPresetEnum valueOf(String name) => _$aiQuantConversationBacktestRangeResponseDtoPresetEnumValueOf(name);
}

