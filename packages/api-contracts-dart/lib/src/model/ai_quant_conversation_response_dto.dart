//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/ai_quant_conversation_message_response_dto.dart';
import 'package:backend_api_contracts/src/model/ai_quant_conversation_backtest_config_response_dto.dart';
import 'package:backend_api_contracts/src/model/ai_quant_conversation_last_backtest_ref_response_dto.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'ai_quant_conversation_response_dto.g.dart';

/// AiQuantConversationResponseDto
///
/// Properties:
/// * [id] - 对话 ID
/// * [activeCodegenSessionId] - 当前关联的代码生成会话 ID
/// * [conversationTitle] - 对话标题
/// * [conversationMessages] - 结构化对话记录
/// * [status] - 当前代码生成状态
/// * [createdAt] - 对话创建时间
/// * [updatedAt] - 对话更新时间
/// * [backtestDraftConfig] - 当前显式回测草稿配置
/// * [lastBacktestRef] - 最近可恢复的回测引用
/// * [canonicalDigest] - 待确认的规范化摘要
/// * [specDesc] - 结构化策略描述载荷
/// * [semanticGraph] - 语义图载荷
/// * [validationReport] - 语义图校验报告
/// * [clarificationGate] - 澄清门载荷
/// * [publicationGate] - 发布门载荷
/// * [scriptCode] - 已发布脚本代码
/// * [publishedSnapshotId] - 已发布快照 ID
/// * [publishedSnapshotParamValues] - 快照绑定的参数值（用于已发布回测/展示语义）
/// * [publishedSnapshotStrategyConfig] - 已发布快照的正式策略配置
/// * [publishedSnapshotBacktestConfigDefaults] - 已发布快照的正式回测默认值
/// * [publishedSnapshotDeploymentExecutionDefaults] - 已发布快照的正式部署默认值
/// * [publishedSnapshotDeploymentExecutionConstraints] - 已发布快照的正式部署约束
/// * [publishedSnapshotCompatibilityMetadata] - 已发布快照的兼容性元数据
/// * [strategyInstanceId] - 已发布策略实例 ID
/// * [rejectReason] - 终止拒绝原因
@BuiltValue()
abstract class AiQuantConversationResponseDto implements Built<AiQuantConversationResponseDto, AiQuantConversationResponseDtoBuilder> {
  /// 对话 ID
  @BuiltValueField(wireName: r'id')
  String get id;

  /// 当前关联的代码生成会话 ID
  @BuiltValueField(wireName: r'activeCodegenSessionId')
  String? get activeCodegenSessionId;

  /// 对话标题
  @BuiltValueField(wireName: r'conversationTitle')
  String? get conversationTitle;

  /// 结构化对话记录
  @BuiltValueField(wireName: r'conversationMessages')
  BuiltList<AiQuantConversationMessageResponseDto>? get conversationMessages;

  /// 当前代码生成状态
  @BuiltValueField(wireName: r'status')
  String? get status;

  /// 对话创建时间
  @BuiltValueField(wireName: r'createdAt')
  String? get createdAt;

  /// 对话更新时间
  @BuiltValueField(wireName: r'updatedAt')
  String? get updatedAt;

  /// 当前显式回测草稿配置
  @BuiltValueField(wireName: r'backtestDraftConfig')
  AiQuantConversationBacktestConfigResponseDto? get backtestDraftConfig;

  /// 最近可恢复的回测引用
  @BuiltValueField(wireName: r'lastBacktestRef')
  AiQuantConversationLastBacktestRefResponseDto? get lastBacktestRef;

  /// 待确认的规范化摘要
  @BuiltValueField(wireName: r'canonicalDigest')
  String? get canonicalDigest;

  /// 结构化策略描述载荷
  @BuiltValueField(wireName: r'specDesc')
  BuiltMap<String, JsonObject?>? get specDesc;

  /// 语义图载荷
  @BuiltValueField(wireName: r'semanticGraph')
  BuiltMap<String, JsonObject?>? get semanticGraph;

  /// 语义图校验报告
  @BuiltValueField(wireName: r'validationReport')
  BuiltMap<String, JsonObject?>? get validationReport;

  /// 澄清门载荷
  @BuiltValueField(wireName: r'clarificationGate')
  BuiltMap<String, JsonObject?>? get clarificationGate;

  /// 发布门载荷
  @BuiltValueField(wireName: r'publicationGate')
  BuiltMap<String, JsonObject?>? get publicationGate;

  /// 已发布脚本代码
  @BuiltValueField(wireName: r'scriptCode')
  String? get scriptCode;

  /// 已发布快照 ID
  @BuiltValueField(wireName: r'publishedSnapshotId')
  String? get publishedSnapshotId;

  /// 快照绑定的参数值（用于已发布回测/展示语义）
  @BuiltValueField(wireName: r'publishedSnapshotParamValues')
  BuiltMap<String, JsonObject?>? get publishedSnapshotParamValues;

  /// 已发布快照的正式策略配置
  @BuiltValueField(wireName: r'publishedSnapshotStrategyConfig')
  BuiltMap<String, JsonObject?>? get publishedSnapshotStrategyConfig;

  /// 已发布快照的正式回测默认值
  @BuiltValueField(wireName: r'publishedSnapshotBacktestConfigDefaults')
  BuiltMap<String, JsonObject?>? get publishedSnapshotBacktestConfigDefaults;

  /// 已发布快照的正式部署默认值
  @BuiltValueField(wireName: r'publishedSnapshotDeploymentExecutionDefaults')
  BuiltMap<String, JsonObject?>? get publishedSnapshotDeploymentExecutionDefaults;

  /// 已发布快照的正式部署约束
  @BuiltValueField(wireName: r'publishedSnapshotDeploymentExecutionConstraints')
  BuiltMap<String, JsonObject?>? get publishedSnapshotDeploymentExecutionConstraints;

  /// 已发布快照的兼容性元数据
  @BuiltValueField(wireName: r'publishedSnapshotCompatibilityMetadata')
  BuiltMap<String, JsonObject?>? get publishedSnapshotCompatibilityMetadata;

  /// 已发布策略实例 ID
  @BuiltValueField(wireName: r'strategyInstanceId')
  String? get strategyInstanceId;

  /// 终止拒绝原因
  @BuiltValueField(wireName: r'rejectReason')
  String? get rejectReason;

  AiQuantConversationResponseDto._();

  factory AiQuantConversationResponseDto([void updates(AiQuantConversationResponseDtoBuilder b)]) = _$AiQuantConversationResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AiQuantConversationResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AiQuantConversationResponseDto> get serializer => _$AiQuantConversationResponseDtoSerializer();
}

class _$AiQuantConversationResponseDtoSerializer implements PrimitiveSerializer<AiQuantConversationResponseDto> {
  @override
  final Iterable<Type> types = const [AiQuantConversationResponseDto, _$AiQuantConversationResponseDto];

  @override
  final String wireName = r'AiQuantConversationResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AiQuantConversationResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    if (object.activeCodegenSessionId != null) {
      yield r'activeCodegenSessionId';
      yield serializers.serialize(
        object.activeCodegenSessionId,
        specifiedType: const FullType(String),
      );
    }
    if (object.conversationTitle != null) {
      yield r'conversationTitle';
      yield serializers.serialize(
        object.conversationTitle,
        specifiedType: const FullType(String),
      );
    }
    if (object.conversationMessages != null) {
      yield r'conversationMessages';
      yield serializers.serialize(
        object.conversationMessages,
        specifiedType: const FullType(BuiltList, [FullType(AiQuantConversationMessageResponseDto)]),
      );
    }
    if (object.status != null) {
      yield r'status';
      yield serializers.serialize(
        object.status,
        specifiedType: const FullType(String),
      );
    }
    if (object.createdAt != null) {
      yield r'createdAt';
      yield serializers.serialize(
        object.createdAt,
        specifiedType: const FullType(String),
      );
    }
    if (object.updatedAt != null) {
      yield r'updatedAt';
      yield serializers.serialize(
        object.updatedAt,
        specifiedType: const FullType(String),
      );
    }
    if (object.backtestDraftConfig != null) {
      yield r'backtestDraftConfig';
      yield serializers.serialize(
        object.backtestDraftConfig,
        specifiedType: const FullType.nullable(AiQuantConversationBacktestConfigResponseDto),
      );
    }
    if (object.lastBacktestRef != null) {
      yield r'lastBacktestRef';
      yield serializers.serialize(
        object.lastBacktestRef,
        specifiedType: const FullType.nullable(AiQuantConversationLastBacktestRefResponseDto),
      );
    }
    if (object.canonicalDigest != null) {
      yield r'canonicalDigest';
      yield serializers.serialize(
        object.canonicalDigest,
        specifiedType: const FullType(String),
      );
    }
    if (object.specDesc != null) {
      yield r'specDesc';
      yield serializers.serialize(
        object.specDesc,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.semanticGraph != null) {
      yield r'semanticGraph';
      yield serializers.serialize(
        object.semanticGraph,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.validationReport != null) {
      yield r'validationReport';
      yield serializers.serialize(
        object.validationReport,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.clarificationGate != null) {
      yield r'clarificationGate';
      yield serializers.serialize(
        object.clarificationGate,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.publicationGate != null) {
      yield r'publicationGate';
      yield serializers.serialize(
        object.publicationGate,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.scriptCode != null) {
      yield r'scriptCode';
      yield serializers.serialize(
        object.scriptCode,
        specifiedType: const FullType(String),
      );
    }
    if (object.publishedSnapshotId != null) {
      yield r'publishedSnapshotId';
      yield serializers.serialize(
        object.publishedSnapshotId,
        specifiedType: const FullType(String),
      );
    }
    if (object.publishedSnapshotParamValues != null) {
      yield r'publishedSnapshotParamValues';
      yield serializers.serialize(
        object.publishedSnapshotParamValues,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.publishedSnapshotStrategyConfig != null) {
      yield r'publishedSnapshotStrategyConfig';
      yield serializers.serialize(
        object.publishedSnapshotStrategyConfig,
        specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.publishedSnapshotBacktestConfigDefaults != null) {
      yield r'publishedSnapshotBacktestConfigDefaults';
      yield serializers.serialize(
        object.publishedSnapshotBacktestConfigDefaults,
        specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.publishedSnapshotDeploymentExecutionDefaults != null) {
      yield r'publishedSnapshotDeploymentExecutionDefaults';
      yield serializers.serialize(
        object.publishedSnapshotDeploymentExecutionDefaults,
        specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.publishedSnapshotDeploymentExecutionConstraints != null) {
      yield r'publishedSnapshotDeploymentExecutionConstraints';
      yield serializers.serialize(
        object.publishedSnapshotDeploymentExecutionConstraints,
        specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.publishedSnapshotCompatibilityMetadata != null) {
      yield r'publishedSnapshotCompatibilityMetadata';
      yield serializers.serialize(
        object.publishedSnapshotCompatibilityMetadata,
        specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.strategyInstanceId != null) {
      yield r'strategyInstanceId';
      yield serializers.serialize(
        object.strategyInstanceId,
        specifiedType: const FullType(String),
      );
    }
    if (object.rejectReason != null) {
      yield r'rejectReason';
      yield serializers.serialize(
        object.rejectReason,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    AiQuantConversationResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AiQuantConversationResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.id = valueDes;
          break;
        case r'activeCodegenSessionId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.activeCodegenSessionId = valueDes;
          break;
        case r'conversationTitle':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.conversationTitle = valueDes;
          break;
        case r'conversationMessages':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(AiQuantConversationMessageResponseDto)]),
          ) as BuiltList<AiQuantConversationMessageResponseDto>;
          result.conversationMessages.replace(valueDes);
          break;
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.status = valueDes;
          break;
        case r'createdAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.createdAt = valueDes;
          break;
        case r'updatedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.updatedAt = valueDes;
          break;
        case r'backtestDraftConfig':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(AiQuantConversationBacktestConfigResponseDto),
          ) as AiQuantConversationBacktestConfigResponseDto?;
          if (valueDes == null) continue;
          result.backtestDraftConfig.replace(valueDes);
          break;
        case r'lastBacktestRef':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(AiQuantConversationLastBacktestRefResponseDto),
          ) as AiQuantConversationLastBacktestRefResponseDto?;
          if (valueDes == null) continue;
          result.lastBacktestRef.replace(valueDes);
          break;
        case r'canonicalDigest':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.canonicalDigest = valueDes;
          break;
        case r'specDesc':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.specDesc.replace(valueDes);
          break;
        case r'semanticGraph':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.semanticGraph.replace(valueDes);
          break;
        case r'validationReport':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.validationReport.replace(valueDes);
          break;
        case r'clarificationGate':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.clarificationGate.replace(valueDes);
          break;
        case r'publicationGate':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.publicationGate.replace(valueDes);
          break;
        case r'scriptCode':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.scriptCode = valueDes;
          break;
        case r'publishedSnapshotId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.publishedSnapshotId = valueDes;
          break;
        case r'publishedSnapshotParamValues':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.publishedSnapshotParamValues.replace(valueDes);
          break;
        case r'publishedSnapshotStrategyConfig':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>?;
          if (valueDes == null) continue;
          result.publishedSnapshotStrategyConfig.replace(valueDes);
          break;
        case r'publishedSnapshotBacktestConfigDefaults':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>?;
          if (valueDes == null) continue;
          result.publishedSnapshotBacktestConfigDefaults.replace(valueDes);
          break;
        case r'publishedSnapshotDeploymentExecutionDefaults':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>?;
          if (valueDes == null) continue;
          result.publishedSnapshotDeploymentExecutionDefaults.replace(valueDes);
          break;
        case r'publishedSnapshotDeploymentExecutionConstraints':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>?;
          if (valueDes == null) continue;
          result.publishedSnapshotDeploymentExecutionConstraints.replace(valueDes);
          break;
        case r'publishedSnapshotCompatibilityMetadata':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>?;
          if (valueDes == null) continue;
          result.publishedSnapshotCompatibilityMetadata.replace(valueDes);
          break;
        case r'strategyInstanceId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.strategyInstanceId = valueDes;
          break;
        case r'rejectReason':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.rejectReason = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AiQuantConversationResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AiQuantConversationResponseDtoBuilder();
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

