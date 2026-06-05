//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/ai_quant_conversation_backtest_execution_response_dto.dart';
import 'package:backend_api_contracts/src/model/ai_quant_conversation_backtest_range_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'ai_quant_conversation_backtest_config_response_dto.g.dart';

/// AiQuantConversationBacktestConfigResponseDto
///
/// Properties:
/// * [range] 
/// * [execution] 
@BuiltValue()
abstract class AiQuantConversationBacktestConfigResponseDto implements Built<AiQuantConversationBacktestConfigResponseDto, AiQuantConversationBacktestConfigResponseDtoBuilder> {
  @BuiltValueField(wireName: r'range')
  AiQuantConversationBacktestRangeResponseDto get range;

  @BuiltValueField(wireName: r'execution')
  AiQuantConversationBacktestExecutionResponseDto get execution;

  AiQuantConversationBacktestConfigResponseDto._();

  factory AiQuantConversationBacktestConfigResponseDto([void updates(AiQuantConversationBacktestConfigResponseDtoBuilder b)]) = _$AiQuantConversationBacktestConfigResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AiQuantConversationBacktestConfigResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AiQuantConversationBacktestConfigResponseDto> get serializer => _$AiQuantConversationBacktestConfigResponseDtoSerializer();
}

class _$AiQuantConversationBacktestConfigResponseDtoSerializer implements PrimitiveSerializer<AiQuantConversationBacktestConfigResponseDto> {
  @override
  final Iterable<Type> types = const [AiQuantConversationBacktestConfigResponseDto, _$AiQuantConversationBacktestConfigResponseDto];

  @override
  final String wireName = r'AiQuantConversationBacktestConfigResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AiQuantConversationBacktestConfigResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'range';
    yield serializers.serialize(
      object.range,
      specifiedType: const FullType(AiQuantConversationBacktestRangeResponseDto),
    );
    yield r'execution';
    yield serializers.serialize(
      object.execution,
      specifiedType: const FullType(AiQuantConversationBacktestExecutionResponseDto),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AiQuantConversationBacktestConfigResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AiQuantConversationBacktestConfigResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'range':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AiQuantConversationBacktestRangeResponseDto),
          ) as AiQuantConversationBacktestRangeResponseDto;
          result.range.replace(valueDes);
          break;
        case r'execution':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AiQuantConversationBacktestExecutionResponseDto),
          ) as AiQuantConversationBacktestExecutionResponseDto;
          result.execution.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AiQuantConversationBacktestConfigResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AiQuantConversationBacktestConfigResponseDtoBuilder();
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

