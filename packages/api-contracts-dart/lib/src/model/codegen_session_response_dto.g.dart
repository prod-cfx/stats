// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'codegen_session_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const CodegenSessionResponseDtoStatusEnum
_$codegenSessionResponseDtoStatusEnum_DRAFTING =
    const CodegenSessionResponseDtoStatusEnum._('DRAFTING');
const CodegenSessionResponseDtoStatusEnum
_$codegenSessionResponseDtoStatusEnum_CONFIRM_GATE =
    const CodegenSessionResponseDtoStatusEnum._('CONFIRM_GATE');
const CodegenSessionResponseDtoStatusEnum
_$codegenSessionResponseDtoStatusEnum_GENERATING =
    const CodegenSessionResponseDtoStatusEnum._('GENERATING');
const CodegenSessionResponseDtoStatusEnum
_$codegenSessionResponseDtoStatusEnum_VALIDATING_STATIC =
    const CodegenSessionResponseDtoStatusEnum._('VALIDATING_STATIC');
const CodegenSessionResponseDtoStatusEnum
_$codegenSessionResponseDtoStatusEnum_VALIDATING_RUNTIME =
    const CodegenSessionResponseDtoStatusEnum._('VALIDATING_RUNTIME');
const CodegenSessionResponseDtoStatusEnum
_$codegenSessionResponseDtoStatusEnum_VALIDATING_OUTPUT =
    const CodegenSessionResponseDtoStatusEnum._('VALIDATING_OUTPUT');
const CodegenSessionResponseDtoStatusEnum
_$codegenSessionResponseDtoStatusEnum_VALIDATING_CONSISTENCY =
    const CodegenSessionResponseDtoStatusEnum._('VALIDATING_CONSISTENCY');
const CodegenSessionResponseDtoStatusEnum
_$codegenSessionResponseDtoStatusEnum_PUBLISHED =
    const CodegenSessionResponseDtoStatusEnum._('PUBLISHED');
const CodegenSessionResponseDtoStatusEnum
_$codegenSessionResponseDtoStatusEnum_CONSISTENCY_FAILED =
    const CodegenSessionResponseDtoStatusEnum._('CONSISTENCY_FAILED');
const CodegenSessionResponseDtoStatusEnum
_$codegenSessionResponseDtoStatusEnum_REJECTED =
    const CodegenSessionResponseDtoStatusEnum._('REJECTED');

CodegenSessionResponseDtoStatusEnum
_$codegenSessionResponseDtoStatusEnumValueOf(String name) {
  switch (name) {
    case 'DRAFTING':
      return _$codegenSessionResponseDtoStatusEnum_DRAFTING;
    case 'CONFIRM_GATE':
      return _$codegenSessionResponseDtoStatusEnum_CONFIRM_GATE;
    case 'GENERATING':
      return _$codegenSessionResponseDtoStatusEnum_GENERATING;
    case 'VALIDATING_STATIC':
      return _$codegenSessionResponseDtoStatusEnum_VALIDATING_STATIC;
    case 'VALIDATING_RUNTIME':
      return _$codegenSessionResponseDtoStatusEnum_VALIDATING_RUNTIME;
    case 'VALIDATING_OUTPUT':
      return _$codegenSessionResponseDtoStatusEnum_VALIDATING_OUTPUT;
    case 'VALIDATING_CONSISTENCY':
      return _$codegenSessionResponseDtoStatusEnum_VALIDATING_CONSISTENCY;
    case 'PUBLISHED':
      return _$codegenSessionResponseDtoStatusEnum_PUBLISHED;
    case 'CONSISTENCY_FAILED':
      return _$codegenSessionResponseDtoStatusEnum_CONSISTENCY_FAILED;
    case 'REJECTED':
      return _$codegenSessionResponseDtoStatusEnum_REJECTED;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<CodegenSessionResponseDtoStatusEnum>
_$codegenSessionResponseDtoStatusEnumValues =
    BuiltSet<CodegenSessionResponseDtoStatusEnum>(
      const <CodegenSessionResponseDtoStatusEnum>[
        _$codegenSessionResponseDtoStatusEnum_DRAFTING,
        _$codegenSessionResponseDtoStatusEnum_CONFIRM_GATE,
        _$codegenSessionResponseDtoStatusEnum_GENERATING,
        _$codegenSessionResponseDtoStatusEnum_VALIDATING_STATIC,
        _$codegenSessionResponseDtoStatusEnum_VALIDATING_RUNTIME,
        _$codegenSessionResponseDtoStatusEnum_VALIDATING_OUTPUT,
        _$codegenSessionResponseDtoStatusEnum_VALIDATING_CONSISTENCY,
        _$codegenSessionResponseDtoStatusEnum_PUBLISHED,
        _$codegenSessionResponseDtoStatusEnum_CONSISTENCY_FAILED,
        _$codegenSessionResponseDtoStatusEnum_REJECTED,
      ],
    );

Serializer<CodegenSessionResponseDtoStatusEnum>
_$codegenSessionResponseDtoStatusEnumSerializer =
    _$CodegenSessionResponseDtoStatusEnumSerializer();

class _$CodegenSessionResponseDtoStatusEnumSerializer
    implements PrimitiveSerializer<CodegenSessionResponseDtoStatusEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'DRAFTING': 'DRAFTING',
    'CONFIRM_GATE': 'CONFIRM_GATE',
    'GENERATING': 'GENERATING',
    'VALIDATING_STATIC': 'VALIDATING_STATIC',
    'VALIDATING_RUNTIME': 'VALIDATING_RUNTIME',
    'VALIDATING_OUTPUT': 'VALIDATING_OUTPUT',
    'VALIDATING_CONSISTENCY': 'VALIDATING_CONSISTENCY',
    'PUBLISHED': 'PUBLISHED',
    'CONSISTENCY_FAILED': 'CONSISTENCY_FAILED',
    'REJECTED': 'REJECTED',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'DRAFTING': 'DRAFTING',
    'CONFIRM_GATE': 'CONFIRM_GATE',
    'GENERATING': 'GENERATING',
    'VALIDATING_STATIC': 'VALIDATING_STATIC',
    'VALIDATING_RUNTIME': 'VALIDATING_RUNTIME',
    'VALIDATING_OUTPUT': 'VALIDATING_OUTPUT',
    'VALIDATING_CONSISTENCY': 'VALIDATING_CONSISTENCY',
    'PUBLISHED': 'PUBLISHED',
    'CONSISTENCY_FAILED': 'CONSISTENCY_FAILED',
    'REJECTED': 'REJECTED',
  };

  @override
  final Iterable<Type> types = const <Type>[
    CodegenSessionResponseDtoStatusEnum,
  ];
  @override
  final String wireName = 'CodegenSessionResponseDtoStatusEnum';

  @override
  Object serialize(
    Serializers serializers,
    CodegenSessionResponseDtoStatusEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  CodegenSessionResponseDtoStatusEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => CodegenSessionResponseDtoStatusEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$CodegenSessionResponseDto extends CodegenSessionResponseDto {
  @override
  final String id;
  @override
  final String? conversationId;
  @override
  final String? conversationTitle;
  @override
  final BuiltList<CodegenConversationMessageResponseDto>? conversationMessages;
  @override
  final CodegenSessionResponseDtoStatusEnum status;
  @override
  final BuiltList<String>? missingFields;
  @override
  final String? scriptCode;
  @override
  final String? publishedSnapshotId;
  @override
  final BuiltMap<String, JsonObject?>? publishedSnapshotParamValues;
  @override
  final BuiltMap<String, JsonObject?>? publishedSnapshotStrategyConfig;
  @override
  final BuiltMap<String, JsonObject?>? publishedSnapshotBacktestConfigDefaults;
  @override
  final BuiltMap<String, JsonObject?>?
  publishedSnapshotDeploymentExecutionDefaults;
  @override
  final BuiltMap<String, JsonObject?>?
  publishedSnapshotDeploymentExecutionConstraints;
  @override
  final BuiltMap<String, JsonObject?>? publishedSnapshotCompatibilityMetadata;
  @override
  final BuiltMap<String, JsonObject?>? consistencyReport;
  @override
  final BuiltMap<String, JsonObject?>? specDesc;
  @override
  final String? canonicalDigest;
  @override
  final BuiltMap<String, JsonObject?>? semanticGraph;
  @override
  final BuiltMap<String, JsonObject?>? validationReport;
  @override
  final BuiltMap<String, JsonObject?>? clarificationState;
  @override
  final BuiltMap<String, JsonObject?> clarificationGate;
  @override
  final BuiltMap<String, JsonObject?>? publicationGate;
  @override
  final String? strategyInstanceId;
  @override
  final String? rejectReason;
  @override
  final String? assistantPrompt;

  factory _$CodegenSessionResponseDto([
    void Function(CodegenSessionResponseDtoBuilder)? updates,
  ]) => (CodegenSessionResponseDtoBuilder()..update(updates))._build();

  _$CodegenSessionResponseDto._({
    required this.id,
    this.conversationId,
    this.conversationTitle,
    this.conversationMessages,
    required this.status,
    this.missingFields,
    this.scriptCode,
    this.publishedSnapshotId,
    this.publishedSnapshotParamValues,
    this.publishedSnapshotStrategyConfig,
    this.publishedSnapshotBacktestConfigDefaults,
    this.publishedSnapshotDeploymentExecutionDefaults,
    this.publishedSnapshotDeploymentExecutionConstraints,
    this.publishedSnapshotCompatibilityMetadata,
    this.consistencyReport,
    this.specDesc,
    this.canonicalDigest,
    this.semanticGraph,
    this.validationReport,
    this.clarificationState,
    required this.clarificationGate,
    this.publicationGate,
    this.strategyInstanceId,
    this.rejectReason,
    this.assistantPrompt,
  }) : super._();
  @override
  CodegenSessionResponseDto rebuild(
    void Function(CodegenSessionResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  CodegenSessionResponseDtoBuilder toBuilder() =>
      CodegenSessionResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CodegenSessionResponseDto &&
        id == other.id &&
        conversationId == other.conversationId &&
        conversationTitle == other.conversationTitle &&
        conversationMessages == other.conversationMessages &&
        status == other.status &&
        missingFields == other.missingFields &&
        scriptCode == other.scriptCode &&
        publishedSnapshotId == other.publishedSnapshotId &&
        publishedSnapshotParamValues == other.publishedSnapshotParamValues &&
        publishedSnapshotStrategyConfig ==
            other.publishedSnapshotStrategyConfig &&
        publishedSnapshotBacktestConfigDefaults ==
            other.publishedSnapshotBacktestConfigDefaults &&
        publishedSnapshotDeploymentExecutionDefaults ==
            other.publishedSnapshotDeploymentExecutionDefaults &&
        publishedSnapshotDeploymentExecutionConstraints ==
            other.publishedSnapshotDeploymentExecutionConstraints &&
        publishedSnapshotCompatibilityMetadata ==
            other.publishedSnapshotCompatibilityMetadata &&
        consistencyReport == other.consistencyReport &&
        specDesc == other.specDesc &&
        canonicalDigest == other.canonicalDigest &&
        semanticGraph == other.semanticGraph &&
        validationReport == other.validationReport &&
        clarificationState == other.clarificationState &&
        clarificationGate == other.clarificationGate &&
        publicationGate == other.publicationGate &&
        strategyInstanceId == other.strategyInstanceId &&
        rejectReason == other.rejectReason &&
        assistantPrompt == other.assistantPrompt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, conversationId.hashCode);
    _$hash = $jc(_$hash, conversationTitle.hashCode);
    _$hash = $jc(_$hash, conversationMessages.hashCode);
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jc(_$hash, missingFields.hashCode);
    _$hash = $jc(_$hash, scriptCode.hashCode);
    _$hash = $jc(_$hash, publishedSnapshotId.hashCode);
    _$hash = $jc(_$hash, publishedSnapshotParamValues.hashCode);
    _$hash = $jc(_$hash, publishedSnapshotStrategyConfig.hashCode);
    _$hash = $jc(_$hash, publishedSnapshotBacktestConfigDefaults.hashCode);
    _$hash = $jc(_$hash, publishedSnapshotDeploymentExecutionDefaults.hashCode);
    _$hash = $jc(
      _$hash,
      publishedSnapshotDeploymentExecutionConstraints.hashCode,
    );
    _$hash = $jc(_$hash, publishedSnapshotCompatibilityMetadata.hashCode);
    _$hash = $jc(_$hash, consistencyReport.hashCode);
    _$hash = $jc(_$hash, specDesc.hashCode);
    _$hash = $jc(_$hash, canonicalDigest.hashCode);
    _$hash = $jc(_$hash, semanticGraph.hashCode);
    _$hash = $jc(_$hash, validationReport.hashCode);
    _$hash = $jc(_$hash, clarificationState.hashCode);
    _$hash = $jc(_$hash, clarificationGate.hashCode);
    _$hash = $jc(_$hash, publicationGate.hashCode);
    _$hash = $jc(_$hash, strategyInstanceId.hashCode);
    _$hash = $jc(_$hash, rejectReason.hashCode);
    _$hash = $jc(_$hash, assistantPrompt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'CodegenSessionResponseDto')
          ..add('id', id)
          ..add('conversationId', conversationId)
          ..add('conversationTitle', conversationTitle)
          ..add('conversationMessages', conversationMessages)
          ..add('status', status)
          ..add('missingFields', missingFields)
          ..add('scriptCode', scriptCode)
          ..add('publishedSnapshotId', publishedSnapshotId)
          ..add('publishedSnapshotParamValues', publishedSnapshotParamValues)
          ..add(
            'publishedSnapshotStrategyConfig',
            publishedSnapshotStrategyConfig,
          )
          ..add(
            'publishedSnapshotBacktestConfigDefaults',
            publishedSnapshotBacktestConfigDefaults,
          )
          ..add(
            'publishedSnapshotDeploymentExecutionDefaults',
            publishedSnapshotDeploymentExecutionDefaults,
          )
          ..add(
            'publishedSnapshotDeploymentExecutionConstraints',
            publishedSnapshotDeploymentExecutionConstraints,
          )
          ..add(
            'publishedSnapshotCompatibilityMetadata',
            publishedSnapshotCompatibilityMetadata,
          )
          ..add('consistencyReport', consistencyReport)
          ..add('specDesc', specDesc)
          ..add('canonicalDigest', canonicalDigest)
          ..add('semanticGraph', semanticGraph)
          ..add('validationReport', validationReport)
          ..add('clarificationState', clarificationState)
          ..add('clarificationGate', clarificationGate)
          ..add('publicationGate', publicationGate)
          ..add('strategyInstanceId', strategyInstanceId)
          ..add('rejectReason', rejectReason)
          ..add('assistantPrompt', assistantPrompt))
        .toString();
  }
}

class CodegenSessionResponseDtoBuilder
    implements
        Builder<CodegenSessionResponseDto, CodegenSessionResponseDtoBuilder> {
  _$CodegenSessionResponseDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _conversationId;
  String? get conversationId => _$this._conversationId;
  set conversationId(String? conversationId) =>
      _$this._conversationId = conversationId;

  String? _conversationTitle;
  String? get conversationTitle => _$this._conversationTitle;
  set conversationTitle(String? conversationTitle) =>
      _$this._conversationTitle = conversationTitle;

  ListBuilder<CodegenConversationMessageResponseDto>? _conversationMessages;
  ListBuilder<CodegenConversationMessageResponseDto> get conversationMessages =>
      _$this._conversationMessages ??=
          ListBuilder<CodegenConversationMessageResponseDto>();
  set conversationMessages(
    ListBuilder<CodegenConversationMessageResponseDto>? conversationMessages,
  ) => _$this._conversationMessages = conversationMessages;

  CodegenSessionResponseDtoStatusEnum? _status;
  CodegenSessionResponseDtoStatusEnum? get status => _$this._status;
  set status(CodegenSessionResponseDtoStatusEnum? status) =>
      _$this._status = status;

  ListBuilder<String>? _missingFields;
  ListBuilder<String> get missingFields =>
      _$this._missingFields ??= ListBuilder<String>();
  set missingFields(ListBuilder<String>? missingFields) =>
      _$this._missingFields = missingFields;

  String? _scriptCode;
  String? get scriptCode => _$this._scriptCode;
  set scriptCode(String? scriptCode) => _$this._scriptCode = scriptCode;

  String? _publishedSnapshotId;
  String? get publishedSnapshotId => _$this._publishedSnapshotId;
  set publishedSnapshotId(String? publishedSnapshotId) =>
      _$this._publishedSnapshotId = publishedSnapshotId;

  MapBuilder<String, JsonObject?>? _publishedSnapshotParamValues;
  MapBuilder<String, JsonObject?> get publishedSnapshotParamValues =>
      _$this._publishedSnapshotParamValues ??=
          MapBuilder<String, JsonObject?>();
  set publishedSnapshotParamValues(
    MapBuilder<String, JsonObject?>? publishedSnapshotParamValues,
  ) => _$this._publishedSnapshotParamValues = publishedSnapshotParamValues;

  MapBuilder<String, JsonObject?>? _publishedSnapshotStrategyConfig;
  MapBuilder<String, JsonObject?> get publishedSnapshotStrategyConfig =>
      _$this._publishedSnapshotStrategyConfig ??=
          MapBuilder<String, JsonObject?>();
  set publishedSnapshotStrategyConfig(
    MapBuilder<String, JsonObject?>? publishedSnapshotStrategyConfig,
  ) =>
      _$this._publishedSnapshotStrategyConfig = publishedSnapshotStrategyConfig;

  MapBuilder<String, JsonObject?>? _publishedSnapshotBacktestConfigDefaults;
  MapBuilder<String, JsonObject?> get publishedSnapshotBacktestConfigDefaults =>
      _$this._publishedSnapshotBacktestConfigDefaults ??=
          MapBuilder<String, JsonObject?>();
  set publishedSnapshotBacktestConfigDefaults(
    MapBuilder<String, JsonObject?>? publishedSnapshotBacktestConfigDefaults,
  ) => _$this._publishedSnapshotBacktestConfigDefaults =
      publishedSnapshotBacktestConfigDefaults;

  MapBuilder<String, JsonObject?>?
  _publishedSnapshotDeploymentExecutionDefaults;
  MapBuilder<String, JsonObject?>
  get publishedSnapshotDeploymentExecutionDefaults =>
      _$this._publishedSnapshotDeploymentExecutionDefaults ??=
          MapBuilder<String, JsonObject?>();
  set publishedSnapshotDeploymentExecutionDefaults(
    MapBuilder<String, JsonObject?>?
    publishedSnapshotDeploymentExecutionDefaults,
  ) => _$this._publishedSnapshotDeploymentExecutionDefaults =
      publishedSnapshotDeploymentExecutionDefaults;

  MapBuilder<String, JsonObject?>?
  _publishedSnapshotDeploymentExecutionConstraints;
  MapBuilder<String, JsonObject?>
  get publishedSnapshotDeploymentExecutionConstraints =>
      _$this._publishedSnapshotDeploymentExecutionConstraints ??=
          MapBuilder<String, JsonObject?>();
  set publishedSnapshotDeploymentExecutionConstraints(
    MapBuilder<String, JsonObject?>?
    publishedSnapshotDeploymentExecutionConstraints,
  ) => _$this._publishedSnapshotDeploymentExecutionConstraints =
      publishedSnapshotDeploymentExecutionConstraints;

  MapBuilder<String, JsonObject?>? _publishedSnapshotCompatibilityMetadata;
  MapBuilder<String, JsonObject?> get publishedSnapshotCompatibilityMetadata =>
      _$this._publishedSnapshotCompatibilityMetadata ??=
          MapBuilder<String, JsonObject?>();
  set publishedSnapshotCompatibilityMetadata(
    MapBuilder<String, JsonObject?>? publishedSnapshotCompatibilityMetadata,
  ) => _$this._publishedSnapshotCompatibilityMetadata =
      publishedSnapshotCompatibilityMetadata;

  MapBuilder<String, JsonObject?>? _consistencyReport;
  MapBuilder<String, JsonObject?> get consistencyReport =>
      _$this._consistencyReport ??= MapBuilder<String, JsonObject?>();
  set consistencyReport(MapBuilder<String, JsonObject?>? consistencyReport) =>
      _$this._consistencyReport = consistencyReport;

  MapBuilder<String, JsonObject?>? _specDesc;
  MapBuilder<String, JsonObject?> get specDesc =>
      _$this._specDesc ??= MapBuilder<String, JsonObject?>();
  set specDesc(MapBuilder<String, JsonObject?>? specDesc) =>
      _$this._specDesc = specDesc;

  String? _canonicalDigest;
  String? get canonicalDigest => _$this._canonicalDigest;
  set canonicalDigest(String? canonicalDigest) =>
      _$this._canonicalDigest = canonicalDigest;

  MapBuilder<String, JsonObject?>? _semanticGraph;
  MapBuilder<String, JsonObject?> get semanticGraph =>
      _$this._semanticGraph ??= MapBuilder<String, JsonObject?>();
  set semanticGraph(MapBuilder<String, JsonObject?>? semanticGraph) =>
      _$this._semanticGraph = semanticGraph;

  MapBuilder<String, JsonObject?>? _validationReport;
  MapBuilder<String, JsonObject?> get validationReport =>
      _$this._validationReport ??= MapBuilder<String, JsonObject?>();
  set validationReport(MapBuilder<String, JsonObject?>? validationReport) =>
      _$this._validationReport = validationReport;

  MapBuilder<String, JsonObject?>? _clarificationState;
  MapBuilder<String, JsonObject?> get clarificationState =>
      _$this._clarificationState ??= MapBuilder<String, JsonObject?>();
  set clarificationState(MapBuilder<String, JsonObject?>? clarificationState) =>
      _$this._clarificationState = clarificationState;

  MapBuilder<String, JsonObject?>? _clarificationGate;
  MapBuilder<String, JsonObject?> get clarificationGate =>
      _$this._clarificationGate ??= MapBuilder<String, JsonObject?>();
  set clarificationGate(MapBuilder<String, JsonObject?>? clarificationGate) =>
      _$this._clarificationGate = clarificationGate;

  MapBuilder<String, JsonObject?>? _publicationGate;
  MapBuilder<String, JsonObject?> get publicationGate =>
      _$this._publicationGate ??= MapBuilder<String, JsonObject?>();
  set publicationGate(MapBuilder<String, JsonObject?>? publicationGate) =>
      _$this._publicationGate = publicationGate;

  String? _strategyInstanceId;
  String? get strategyInstanceId => _$this._strategyInstanceId;
  set strategyInstanceId(String? strategyInstanceId) =>
      _$this._strategyInstanceId = strategyInstanceId;

  String? _rejectReason;
  String? get rejectReason => _$this._rejectReason;
  set rejectReason(String? rejectReason) => _$this._rejectReason = rejectReason;

  String? _assistantPrompt;
  String? get assistantPrompt => _$this._assistantPrompt;
  set assistantPrompt(String? assistantPrompt) =>
      _$this._assistantPrompt = assistantPrompt;

  CodegenSessionResponseDtoBuilder() {
    CodegenSessionResponseDto._defaults(this);
  }

  CodegenSessionResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _conversationId = $v.conversationId;
      _conversationTitle = $v.conversationTitle;
      _conversationMessages = $v.conversationMessages?.toBuilder();
      _status = $v.status;
      _missingFields = $v.missingFields?.toBuilder();
      _scriptCode = $v.scriptCode;
      _publishedSnapshotId = $v.publishedSnapshotId;
      _publishedSnapshotParamValues = $v.publishedSnapshotParamValues
          ?.toBuilder();
      _publishedSnapshotStrategyConfig = $v.publishedSnapshotStrategyConfig
          ?.toBuilder();
      _publishedSnapshotBacktestConfigDefaults = $v
          .publishedSnapshotBacktestConfigDefaults
          ?.toBuilder();
      _publishedSnapshotDeploymentExecutionDefaults = $v
          .publishedSnapshotDeploymentExecutionDefaults
          ?.toBuilder();
      _publishedSnapshotDeploymentExecutionConstraints = $v
          .publishedSnapshotDeploymentExecutionConstraints
          ?.toBuilder();
      _publishedSnapshotCompatibilityMetadata = $v
          .publishedSnapshotCompatibilityMetadata
          ?.toBuilder();
      _consistencyReport = $v.consistencyReport?.toBuilder();
      _specDesc = $v.specDesc?.toBuilder();
      _canonicalDigest = $v.canonicalDigest;
      _semanticGraph = $v.semanticGraph?.toBuilder();
      _validationReport = $v.validationReport?.toBuilder();
      _clarificationState = $v.clarificationState?.toBuilder();
      _clarificationGate = $v.clarificationGate.toBuilder();
      _publicationGate = $v.publicationGate?.toBuilder();
      _strategyInstanceId = $v.strategyInstanceId;
      _rejectReason = $v.rejectReason;
      _assistantPrompt = $v.assistantPrompt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CodegenSessionResponseDto other) {
    _$v = other as _$CodegenSessionResponseDto;
  }

  @override
  void update(void Function(CodegenSessionResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  CodegenSessionResponseDto build() => _build();

  _$CodegenSessionResponseDto _build() {
    _$CodegenSessionResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$CodegenSessionResponseDto._(
            id: BuiltValueNullFieldError.checkNotNull(
              id,
              r'CodegenSessionResponseDto',
              'id',
            ),
            conversationId: conversationId,
            conversationTitle: conversationTitle,
            conversationMessages: _conversationMessages?.build(),
            status: BuiltValueNullFieldError.checkNotNull(
              status,
              r'CodegenSessionResponseDto',
              'status',
            ),
            missingFields: _missingFields?.build(),
            scriptCode: scriptCode,
            publishedSnapshotId: publishedSnapshotId,
            publishedSnapshotParamValues: _publishedSnapshotParamValues
                ?.build(),
            publishedSnapshotStrategyConfig: _publishedSnapshotStrategyConfig
                ?.build(),
            publishedSnapshotBacktestConfigDefaults:
                _publishedSnapshotBacktestConfigDefaults?.build(),
            publishedSnapshotDeploymentExecutionDefaults:
                _publishedSnapshotDeploymentExecutionDefaults?.build(),
            publishedSnapshotDeploymentExecutionConstraints:
                _publishedSnapshotDeploymentExecutionConstraints?.build(),
            publishedSnapshotCompatibilityMetadata:
                _publishedSnapshotCompatibilityMetadata?.build(),
            consistencyReport: _consistencyReport?.build(),
            specDesc: _specDesc?.build(),
            canonicalDigest: canonicalDigest,
            semanticGraph: _semanticGraph?.build(),
            validationReport: _validationReport?.build(),
            clarificationState: _clarificationState?.build(),
            clarificationGate: clarificationGate.build(),
            publicationGate: _publicationGate?.build(),
            strategyInstanceId: strategyInstanceId,
            rejectReason: rejectReason,
            assistantPrompt: assistantPrompt,
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'conversationMessages';
        _conversationMessages?.build();

        _$failedField = 'missingFields';
        _missingFields?.build();

        _$failedField = 'publishedSnapshotParamValues';
        _publishedSnapshotParamValues?.build();
        _$failedField = 'publishedSnapshotStrategyConfig';
        _publishedSnapshotStrategyConfig?.build();
        _$failedField = 'publishedSnapshotBacktestConfigDefaults';
        _publishedSnapshotBacktestConfigDefaults?.build();
        _$failedField = 'publishedSnapshotDeploymentExecutionDefaults';
        _publishedSnapshotDeploymentExecutionDefaults?.build();
        _$failedField = 'publishedSnapshotDeploymentExecutionConstraints';
        _publishedSnapshotDeploymentExecutionConstraints?.build();
        _$failedField = 'publishedSnapshotCompatibilityMetadata';
        _publishedSnapshotCompatibilityMetadata?.build();
        _$failedField = 'consistencyReport';
        _consistencyReport?.build();
        _$failedField = 'specDesc';
        _specDesc?.build();

        _$failedField = 'semanticGraph';
        _semanticGraph?.build();
        _$failedField = 'validationReport';
        _validationReport?.build();
        _$failedField = 'clarificationState';
        _clarificationState?.build();
        _$failedField = 'clarificationGate';
        clarificationGate.build();
        _$failedField = 'publicationGate';
        _publicationGate?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'CodegenSessionResponseDto',
          _$failedField,
          e.toString(),
        );
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
