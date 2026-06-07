//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/ai_quant_conversation_backtest_config_response_dto.dart';
import 'package:backend_api_contracts/src/model/ai_quant_conversation_last_backtest_summary_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'ai_quant_conversation_last_backtest_ref_response_dto.g.dart';

/// AiQuantConversationLastBacktestRefResponseDto
///
/// Properties:
/// * [jobId] - 回测任务 ID
/// * [publishedSnapshotId] - 已发布快照 ID
/// * [config] - 回测配置
/// * [summary] - 回测结果摘要
/// * [completedAt] - 回测完成时间（ISO 8601）
@BuiltValue()
abstract class AiQuantConversationLastBacktestRefResponseDto implements Built<AiQuantConversationLastBacktestRefResponseDto, AiQuantConversationLastBacktestRefResponseDtoBuilder> {
  /// 回测任务 ID
  @BuiltValueField(wireName: r'jobId')
  String get jobId;

  /// 已发布快照 ID
  @BuiltValueField(wireName: r'publishedSnapshotId')
  String get publishedSnapshotId;

  /// 回测配置
  @BuiltValueField(wireName: r'config')
  AiQuantConversationBacktestConfigResponseDto get config;

  /// 回测结果摘要
  @BuiltValueField(wireName: r'summary')
  AiQuantConversationLastBacktestSummaryResponseDto get summary;

  /// 回测完成时间（ISO 8601）
  @BuiltValueField(wireName: r'completedAt')
  String get completedAt;

  AiQuantConversationLastBacktestRefResponseDto._();

  factory AiQuantConversationLastBacktestRefResponseDto([void updates(AiQuantConversationLastBacktestRefResponseDtoBuilder b)]) = _$AiQuantConversationLastBacktestRefResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AiQuantConversationLastBacktestRefResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AiQuantConversationLastBacktestRefResponseDto> get serializer => _$AiQuantConversationLastBacktestRefResponseDtoSerializer();
}

class _$AiQuantConversationLastBacktestRefResponseDtoSerializer implements PrimitiveSerializer<AiQuantConversationLastBacktestRefResponseDto> {
  @override
  final Iterable<Type> types = const [AiQuantConversationLastBacktestRefResponseDto, _$AiQuantConversationLastBacktestRefResponseDto];

  @override
  final String wireName = r'AiQuantConversationLastBacktestRefResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AiQuantConversationLastBacktestRefResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'jobId';
    yield serializers.serialize(
      object.jobId,
      specifiedType: const FullType(String),
    );
    yield r'publishedSnapshotId';
    yield serializers.serialize(
      object.publishedSnapshotId,
      specifiedType: const FullType(String),
    );
    yield r'config';
    yield serializers.serialize(
      object.config,
      specifiedType: const FullType(AiQuantConversationBacktestConfigResponseDto),
    );
    yield r'summary';
    yield serializers.serialize(
      object.summary,
      specifiedType: const FullType(AiQuantConversationLastBacktestSummaryResponseDto),
    );
    yield r'completedAt';
    yield serializers.serialize(
      object.completedAt,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AiQuantConversationLastBacktestRefResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AiQuantConversationLastBacktestRefResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'jobId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.jobId = valueDes;
          break;
        case r'publishedSnapshotId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.publishedSnapshotId = valueDes;
          break;
        case r'config':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AiQuantConversationBacktestConfigResponseDto),
          ) as AiQuantConversationBacktestConfigResponseDto;
          result.config.replace(valueDes);
          break;
        case r'summary':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AiQuantConversationLastBacktestSummaryResponseDto),
          ) as AiQuantConversationLastBacktestSummaryResponseDto;
          result.summary.replace(valueDes);
          break;
        case r'completedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.completedAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AiQuantConversationLastBacktestRefResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AiQuantConversationLastBacktestRefResponseDtoBuilder();
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

