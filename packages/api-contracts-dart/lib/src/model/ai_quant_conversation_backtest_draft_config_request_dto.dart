//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/ai_quant_conversation_backtest_config_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'ai_quant_conversation_backtest_draft_config_request_dto.g.dart';

/// AiQuantConversationBacktestDraftConfigRequestDto
///
/// Properties:
/// * [backtestDraftConfig] 
@BuiltValue()
abstract class AiQuantConversationBacktestDraftConfigRequestDto implements Built<AiQuantConversationBacktestDraftConfigRequestDto, AiQuantConversationBacktestDraftConfigRequestDtoBuilder> {
  @BuiltValueField(wireName: r'backtestDraftConfig')
  AiQuantConversationBacktestConfigResponseDto get backtestDraftConfig;

  AiQuantConversationBacktestDraftConfigRequestDto._();

  factory AiQuantConversationBacktestDraftConfigRequestDto([void updates(AiQuantConversationBacktestDraftConfigRequestDtoBuilder b)]) = _$AiQuantConversationBacktestDraftConfigRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AiQuantConversationBacktestDraftConfigRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AiQuantConversationBacktestDraftConfigRequestDto> get serializer => _$AiQuantConversationBacktestDraftConfigRequestDtoSerializer();
}

class _$AiQuantConversationBacktestDraftConfigRequestDtoSerializer implements PrimitiveSerializer<AiQuantConversationBacktestDraftConfigRequestDto> {
  @override
  final Iterable<Type> types = const [AiQuantConversationBacktestDraftConfigRequestDto, _$AiQuantConversationBacktestDraftConfigRequestDto];

  @override
  final String wireName = r'AiQuantConversationBacktestDraftConfigRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AiQuantConversationBacktestDraftConfigRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'backtestDraftConfig';
    yield serializers.serialize(
      object.backtestDraftConfig,
      specifiedType: const FullType(AiQuantConversationBacktestConfigResponseDto),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AiQuantConversationBacktestDraftConfigRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AiQuantConversationBacktestDraftConfigRequestDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'backtestDraftConfig':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AiQuantConversationBacktestConfigResponseDto),
          ) as AiQuantConversationBacktestConfigResponseDto;
          result.backtestDraftConfig.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AiQuantConversationBacktestDraftConfigRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AiQuantConversationBacktestDraftConfigRequestDtoBuilder();
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

