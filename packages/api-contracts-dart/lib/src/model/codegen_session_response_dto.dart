//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/codegen_conversation_message_response_dto.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'codegen_session_response_dto.g.dart';

/// CodegenSessionResponseDto
///
/// Properties:
/// * [id] - Session id
/// * [conversationId] - Current linked conversation id
/// * [conversationTitle] - Conversation title
/// * [conversationMessages] - Structured conversation transcript
/// * [status] - Current codegen status
/// * [missingFields] - Missing fields
/// * [scriptCode] - Latest generated script
/// * [publishedSnapshotId] - Latest published snapshot id
/// * [publishedSnapshotParamValues] - Snapshot-bound param values for published backtest/display semantics
/// * [publishedSnapshotStrategyConfig] - Published snapshot formal strategy configuration
/// * [publishedSnapshotBacktestConfigDefaults] - Published snapshot formal backtest defaults
/// * [publishedSnapshotDeploymentExecutionDefaults] - Published snapshot formal deploy defaults
/// * [publishedSnapshotDeploymentExecutionConstraints] - Published snapshot formal deploy constraints
/// * [publishedSnapshotCompatibilityMetadata] - Published snapshot compatibility metadata
/// * [consistencyReport] - Consistency report payload
/// * [specDesc] - Structured strategy description payload
/// * [canonicalDigest] - Pending canonical digest awaiting confirmation
/// * [semanticGraph] - Semantic graph payload
/// * [validationReport] - Validation report payload
/// * [clarificationState] - Clarification state payload
/// * [clarificationGate] - Clarification gate payload
/// * [publicationGate] - Publication gate payload
/// * [strategyInstanceId] - Published strategy instance id
/// * [rejectReason] - Terminal reject reason
/// * [assistantPrompt] - Assistant follow-up prompt
@BuiltValue()
abstract class CodegenSessionResponseDto implements Built<CodegenSessionResponseDto, CodegenSessionResponseDtoBuilder> {
  /// Session id
  @BuiltValueField(wireName: r'id')
  String get id;

  /// Current linked conversation id
  @BuiltValueField(wireName: r'conversationId')
  String? get conversationId;

  /// Conversation title
  @BuiltValueField(wireName: r'conversationTitle')
  String? get conversationTitle;

  /// Structured conversation transcript
  @BuiltValueField(wireName: r'conversationMessages')
  BuiltList<CodegenConversationMessageResponseDto>? get conversationMessages;

  /// Current codegen status
  @BuiltValueField(wireName: r'status')
  CodegenSessionResponseDtoStatusEnum get status;
  // enum statusEnum {  DRAFTING,  CONFIRM_GATE,  GENERATING,  VALIDATING_STATIC,  VALIDATING_RUNTIME,  VALIDATING_OUTPUT,  VALIDATING_CONSISTENCY,  PUBLISHED,  CONSISTENCY_FAILED,  REJECTED,  };

  /// Missing fields
  @BuiltValueField(wireName: r'missingFields')
  BuiltList<String>? get missingFields;

  /// Latest generated script
  @BuiltValueField(wireName: r'scriptCode')
  String? get scriptCode;

  /// Latest published snapshot id
  @BuiltValueField(wireName: r'publishedSnapshotId')
  String? get publishedSnapshotId;

  /// Snapshot-bound param values for published backtest/display semantics
  @BuiltValueField(wireName: r'publishedSnapshotParamValues')
  BuiltMap<String, JsonObject?>? get publishedSnapshotParamValues;

  /// Published snapshot formal strategy configuration
  @BuiltValueField(wireName: r'publishedSnapshotStrategyConfig')
  BuiltMap<String, JsonObject?>? get publishedSnapshotStrategyConfig;

  /// Published snapshot formal backtest defaults
  @BuiltValueField(wireName: r'publishedSnapshotBacktestConfigDefaults')
  BuiltMap<String, JsonObject?>? get publishedSnapshotBacktestConfigDefaults;

  /// Published snapshot formal deploy defaults
  @BuiltValueField(wireName: r'publishedSnapshotDeploymentExecutionDefaults')
  BuiltMap<String, JsonObject?>? get publishedSnapshotDeploymentExecutionDefaults;

  /// Published snapshot formal deploy constraints
  @BuiltValueField(wireName: r'publishedSnapshotDeploymentExecutionConstraints')
  BuiltMap<String, JsonObject?>? get publishedSnapshotDeploymentExecutionConstraints;

  /// Published snapshot compatibility metadata
  @BuiltValueField(wireName: r'publishedSnapshotCompatibilityMetadata')
  BuiltMap<String, JsonObject?>? get publishedSnapshotCompatibilityMetadata;

  /// Consistency report payload
  @BuiltValueField(wireName: r'consistencyReport')
  BuiltMap<String, JsonObject?>? get consistencyReport;

  /// Structured strategy description payload
  @BuiltValueField(wireName: r'specDesc')
  BuiltMap<String, JsonObject?>? get specDesc;

  /// Pending canonical digest awaiting confirmation
  @BuiltValueField(wireName: r'canonicalDigest')
  String? get canonicalDigest;

  /// Semantic graph payload
  @BuiltValueField(wireName: r'semanticGraph')
  BuiltMap<String, JsonObject?>? get semanticGraph;

  /// Validation report payload
  @BuiltValueField(wireName: r'validationReport')
  BuiltMap<String, JsonObject?>? get validationReport;

  /// Clarification state payload
  @BuiltValueField(wireName: r'clarificationState')
  BuiltMap<String, JsonObject?>? get clarificationState;

  /// Clarification gate payload
  @BuiltValueField(wireName: r'clarificationGate')
  BuiltMap<String, JsonObject?> get clarificationGate;

  /// Publication gate payload
  @BuiltValueField(wireName: r'publicationGate')
  BuiltMap<String, JsonObject?>? get publicationGate;

  /// Published strategy instance id
  @BuiltValueField(wireName: r'strategyInstanceId')
  String? get strategyInstanceId;

  /// Terminal reject reason
  @BuiltValueField(wireName: r'rejectReason')
  String? get rejectReason;

  /// Assistant follow-up prompt
  @BuiltValueField(wireName: r'assistantPrompt')
  String? get assistantPrompt;

  CodegenSessionResponseDto._();

  factory CodegenSessionResponseDto([void updates(CodegenSessionResponseDtoBuilder b)]) = _$CodegenSessionResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CodegenSessionResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<CodegenSessionResponseDto> get serializer => _$CodegenSessionResponseDtoSerializer();
}

class _$CodegenSessionResponseDtoSerializer implements PrimitiveSerializer<CodegenSessionResponseDto> {
  @override
  final Iterable<Type> types = const [CodegenSessionResponseDto, _$CodegenSessionResponseDto];

  @override
  final String wireName = r'CodegenSessionResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CodegenSessionResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    if (object.conversationId != null) {
      yield r'conversationId';
      yield serializers.serialize(
        object.conversationId,
        specifiedType: const FullType.nullable(String),
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
        specifiedType: const FullType(BuiltList, [FullType(CodegenConversationMessageResponseDto)]),
      );
    }
    yield r'status';
    yield serializers.serialize(
      object.status,
      specifiedType: const FullType(CodegenSessionResponseDtoStatusEnum),
    );
    if (object.missingFields != null) {
      yield r'missingFields';
      yield serializers.serialize(
        object.missingFields,
        specifiedType: const FullType(BuiltList, [FullType(String)]),
      );
    }
    if (object.scriptCode != null) {
      yield r'scriptCode';
      yield serializers.serialize(
        object.scriptCode,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.publishedSnapshotId != null) {
      yield r'publishedSnapshotId';
      yield serializers.serialize(
        object.publishedSnapshotId,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.publishedSnapshotParamValues != null) {
      yield r'publishedSnapshotParamValues';
      yield serializers.serialize(
        object.publishedSnapshotParamValues,
        specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
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
    if (object.consistencyReport != null) {
      yield r'consistencyReport';
      yield serializers.serialize(
        object.consistencyReport,
        specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.specDesc != null) {
      yield r'specDesc';
      yield serializers.serialize(
        object.specDesc,
        specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.canonicalDigest != null) {
      yield r'canonicalDigest';
      yield serializers.serialize(
        object.canonicalDigest,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.semanticGraph != null) {
      yield r'semanticGraph';
      yield serializers.serialize(
        object.semanticGraph,
        specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.validationReport != null) {
      yield r'validationReport';
      yield serializers.serialize(
        object.validationReport,
        specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.clarificationState != null) {
      yield r'clarificationState';
      yield serializers.serialize(
        object.clarificationState,
        specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    yield r'clarificationGate';
    yield serializers.serialize(
      object.clarificationGate,
      specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
    );
    if (object.publicationGate != null) {
      yield r'publicationGate';
      yield serializers.serialize(
        object.publicationGate,
        specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.strategyInstanceId != null) {
      yield r'strategyInstanceId';
      yield serializers.serialize(
        object.strategyInstanceId,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.rejectReason != null) {
      yield r'rejectReason';
      yield serializers.serialize(
        object.rejectReason,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.assistantPrompt != null) {
      yield r'assistantPrompt';
      yield serializers.serialize(
        object.assistantPrompt,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    CodegenSessionResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CodegenSessionResponseDtoBuilder result,
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
        case r'conversationId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.conversationId = valueDes;
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
            specifiedType: const FullType(BuiltList, [FullType(CodegenConversationMessageResponseDto)]),
          ) as BuiltList<CodegenConversationMessageResponseDto>;
          result.conversationMessages.replace(valueDes);
          break;
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(CodegenSessionResponseDtoStatusEnum),
          ) as CodegenSessionResponseDtoStatusEnum;
          result.status = valueDes;
          break;
        case r'missingFields':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.missingFields.replace(valueDes);
          break;
        case r'scriptCode':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.scriptCode = valueDes;
          break;
        case r'publishedSnapshotId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.publishedSnapshotId = valueDes;
          break;
        case r'publishedSnapshotParamValues':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>?;
          if (valueDes == null) continue;
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
        case r'consistencyReport':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>?;
          if (valueDes == null) continue;
          result.consistencyReport.replace(valueDes);
          break;
        case r'specDesc':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>?;
          if (valueDes == null) continue;
          result.specDesc.replace(valueDes);
          break;
        case r'canonicalDigest':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.canonicalDigest = valueDes;
          break;
        case r'semanticGraph':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>?;
          if (valueDes == null) continue;
          result.semanticGraph.replace(valueDes);
          break;
        case r'validationReport':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>?;
          if (valueDes == null) continue;
          result.validationReport.replace(valueDes);
          break;
        case r'clarificationState':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>?;
          if (valueDes == null) continue;
          result.clarificationState.replace(valueDes);
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
            specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>?;
          if (valueDes == null) continue;
          result.publicationGate.replace(valueDes);
          break;
        case r'strategyInstanceId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.strategyInstanceId = valueDes;
          break;
        case r'rejectReason':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.rejectReason = valueDes;
          break;
        case r'assistantPrompt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.assistantPrompt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  CodegenSessionResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CodegenSessionResponseDtoBuilder();
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

class CodegenSessionResponseDtoStatusEnum extends EnumClass {

  /// Current codegen status
  @BuiltValueEnumConst(wireName: r'DRAFTING')
  static const CodegenSessionResponseDtoStatusEnum DRAFTING = _$codegenSessionResponseDtoStatusEnum_DRAFTING;
  /// Current codegen status
  @BuiltValueEnumConst(wireName: r'CONFIRM_GATE')
  static const CodegenSessionResponseDtoStatusEnum CONFIRM_GATE = _$codegenSessionResponseDtoStatusEnum_CONFIRM_GATE;
  /// Current codegen status
  @BuiltValueEnumConst(wireName: r'GENERATING')
  static const CodegenSessionResponseDtoStatusEnum GENERATING = _$codegenSessionResponseDtoStatusEnum_GENERATING;
  /// Current codegen status
  @BuiltValueEnumConst(wireName: r'VALIDATING_STATIC')
  static const CodegenSessionResponseDtoStatusEnum VALIDATING_STATIC = _$codegenSessionResponseDtoStatusEnum_VALIDATING_STATIC;
  /// Current codegen status
  @BuiltValueEnumConst(wireName: r'VALIDATING_RUNTIME')
  static const CodegenSessionResponseDtoStatusEnum VALIDATING_RUNTIME = _$codegenSessionResponseDtoStatusEnum_VALIDATING_RUNTIME;
  /// Current codegen status
  @BuiltValueEnumConst(wireName: r'VALIDATING_OUTPUT')
  static const CodegenSessionResponseDtoStatusEnum VALIDATING_OUTPUT = _$codegenSessionResponseDtoStatusEnum_VALIDATING_OUTPUT;
  /// Current codegen status
  @BuiltValueEnumConst(wireName: r'VALIDATING_CONSISTENCY')
  static const CodegenSessionResponseDtoStatusEnum VALIDATING_CONSISTENCY = _$codegenSessionResponseDtoStatusEnum_VALIDATING_CONSISTENCY;
  /// Current codegen status
  @BuiltValueEnumConst(wireName: r'PUBLISHED')
  static const CodegenSessionResponseDtoStatusEnum PUBLISHED = _$codegenSessionResponseDtoStatusEnum_PUBLISHED;
  /// Current codegen status
  @BuiltValueEnumConst(wireName: r'CONSISTENCY_FAILED')
  static const CodegenSessionResponseDtoStatusEnum CONSISTENCY_FAILED = _$codegenSessionResponseDtoStatusEnum_CONSISTENCY_FAILED;
  /// Current codegen status
  @BuiltValueEnumConst(wireName: r'REJECTED')
  static const CodegenSessionResponseDtoStatusEnum REJECTED = _$codegenSessionResponseDtoStatusEnum_REJECTED;

  static Serializer<CodegenSessionResponseDtoStatusEnum> get serializer => _$codegenSessionResponseDtoStatusEnumSerializer;

  const CodegenSessionResponseDtoStatusEnum._(String name): super(name);

  static BuiltSet<CodegenSessionResponseDtoStatusEnum> get values => _$codegenSessionResponseDtoStatusEnumValues;
  static CodegenSessionResponseDtoStatusEnum valueOf(String name) => _$codegenSessionResponseDtoStatusEnumValueOf(name);
}

