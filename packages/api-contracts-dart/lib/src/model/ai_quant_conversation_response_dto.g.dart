// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ai_quant_conversation_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AiQuantConversationResponseDto extends AiQuantConversationResponseDto {
  @override
  final String id;
  @override
  final String? activeCodegenSessionId;
  @override
  final String? conversationTitle;
  @override
  final BuiltList<AiQuantConversationMessageResponseDto>? conversationMessages;
  @override
  final String? status;
  @override
  final String? createdAt;
  @override
  final String? updatedAt;
  @override
  final AiQuantConversationBacktestConfigResponseDto? backtestDraftConfig;
  @override
  final AiQuantConversationLastBacktestRefResponseDto? lastBacktestRef;
  @override
  final String? canonicalDigest;
  @override
  final BuiltMap<String, JsonObject?>? specDesc;
  @override
  final BuiltMap<String, JsonObject?>? semanticGraph;
  @override
  final BuiltMap<String, JsonObject?>? validationReport;
  @override
  final BuiltMap<String, JsonObject?>? clarificationGate;
  @override
  final BuiltMap<String, JsonObject?>? publicationGate;
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
  final String? strategyInstanceId;
  @override
  final String? rejectReason;

  factory _$AiQuantConversationResponseDto([
    void Function(AiQuantConversationResponseDtoBuilder)? updates,
  ]) => (AiQuantConversationResponseDtoBuilder()..update(updates))._build();

  _$AiQuantConversationResponseDto._({
    required this.id,
    this.activeCodegenSessionId,
    this.conversationTitle,
    this.conversationMessages,
    this.status,
    this.createdAt,
    this.updatedAt,
    this.backtestDraftConfig,
    this.lastBacktestRef,
    this.canonicalDigest,
    this.specDesc,
    this.semanticGraph,
    this.validationReport,
    this.clarificationGate,
    this.publicationGate,
    this.scriptCode,
    this.publishedSnapshotId,
    this.publishedSnapshotParamValues,
    this.publishedSnapshotStrategyConfig,
    this.publishedSnapshotBacktestConfigDefaults,
    this.publishedSnapshotDeploymentExecutionDefaults,
    this.publishedSnapshotDeploymentExecutionConstraints,
    this.publishedSnapshotCompatibilityMetadata,
    this.strategyInstanceId,
    this.rejectReason,
  }) : super._();
  @override
  AiQuantConversationResponseDto rebuild(
    void Function(AiQuantConversationResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AiQuantConversationResponseDtoBuilder toBuilder() =>
      AiQuantConversationResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AiQuantConversationResponseDto &&
        id == other.id &&
        activeCodegenSessionId == other.activeCodegenSessionId &&
        conversationTitle == other.conversationTitle &&
        conversationMessages == other.conversationMessages &&
        status == other.status &&
        createdAt == other.createdAt &&
        updatedAt == other.updatedAt &&
        backtestDraftConfig == other.backtestDraftConfig &&
        lastBacktestRef == other.lastBacktestRef &&
        canonicalDigest == other.canonicalDigest &&
        specDesc == other.specDesc &&
        semanticGraph == other.semanticGraph &&
        validationReport == other.validationReport &&
        clarificationGate == other.clarificationGate &&
        publicationGate == other.publicationGate &&
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
        strategyInstanceId == other.strategyInstanceId &&
        rejectReason == other.rejectReason;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, activeCodegenSessionId.hashCode);
    _$hash = $jc(_$hash, conversationTitle.hashCode);
    _$hash = $jc(_$hash, conversationMessages.hashCode);
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jc(_$hash, updatedAt.hashCode);
    _$hash = $jc(_$hash, backtestDraftConfig.hashCode);
    _$hash = $jc(_$hash, lastBacktestRef.hashCode);
    _$hash = $jc(_$hash, canonicalDigest.hashCode);
    _$hash = $jc(_$hash, specDesc.hashCode);
    _$hash = $jc(_$hash, semanticGraph.hashCode);
    _$hash = $jc(_$hash, validationReport.hashCode);
    _$hash = $jc(_$hash, clarificationGate.hashCode);
    _$hash = $jc(_$hash, publicationGate.hashCode);
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
    _$hash = $jc(_$hash, strategyInstanceId.hashCode);
    _$hash = $jc(_$hash, rejectReason.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AiQuantConversationResponseDto')
          ..add('id', id)
          ..add('activeCodegenSessionId', activeCodegenSessionId)
          ..add('conversationTitle', conversationTitle)
          ..add('conversationMessages', conversationMessages)
          ..add('status', status)
          ..add('createdAt', createdAt)
          ..add('updatedAt', updatedAt)
          ..add('backtestDraftConfig', backtestDraftConfig)
          ..add('lastBacktestRef', lastBacktestRef)
          ..add('canonicalDigest', canonicalDigest)
          ..add('specDesc', specDesc)
          ..add('semanticGraph', semanticGraph)
          ..add('validationReport', validationReport)
          ..add('clarificationGate', clarificationGate)
          ..add('publicationGate', publicationGate)
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
          ..add('strategyInstanceId', strategyInstanceId)
          ..add('rejectReason', rejectReason))
        .toString();
  }
}

class AiQuantConversationResponseDtoBuilder
    implements
        Builder<
          AiQuantConversationResponseDto,
          AiQuantConversationResponseDtoBuilder
        > {
  _$AiQuantConversationResponseDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _activeCodegenSessionId;
  String? get activeCodegenSessionId => _$this._activeCodegenSessionId;
  set activeCodegenSessionId(String? activeCodegenSessionId) =>
      _$this._activeCodegenSessionId = activeCodegenSessionId;

  String? _conversationTitle;
  String? get conversationTitle => _$this._conversationTitle;
  set conversationTitle(String? conversationTitle) =>
      _$this._conversationTitle = conversationTitle;

  ListBuilder<AiQuantConversationMessageResponseDto>? _conversationMessages;
  ListBuilder<AiQuantConversationMessageResponseDto> get conversationMessages =>
      _$this._conversationMessages ??=
          ListBuilder<AiQuantConversationMessageResponseDto>();
  set conversationMessages(
    ListBuilder<AiQuantConversationMessageResponseDto>? conversationMessages,
  ) => _$this._conversationMessages = conversationMessages;

  String? _status;
  String? get status => _$this._status;
  set status(String? status) => _$this._status = status;

  String? _createdAt;
  String? get createdAt => _$this._createdAt;
  set createdAt(String? createdAt) => _$this._createdAt = createdAt;

  String? _updatedAt;
  String? get updatedAt => _$this._updatedAt;
  set updatedAt(String? updatedAt) => _$this._updatedAt = updatedAt;

  AiQuantConversationBacktestConfigResponseDtoBuilder? _backtestDraftConfig;
  AiQuantConversationBacktestConfigResponseDtoBuilder get backtestDraftConfig =>
      _$this._backtestDraftConfig ??=
          AiQuantConversationBacktestConfigResponseDtoBuilder();
  set backtestDraftConfig(
    AiQuantConversationBacktestConfigResponseDtoBuilder? backtestDraftConfig,
  ) => _$this._backtestDraftConfig = backtestDraftConfig;

  AiQuantConversationLastBacktestRefResponseDtoBuilder? _lastBacktestRef;
  AiQuantConversationLastBacktestRefResponseDtoBuilder get lastBacktestRef =>
      _$this._lastBacktestRef ??=
          AiQuantConversationLastBacktestRefResponseDtoBuilder();
  set lastBacktestRef(
    AiQuantConversationLastBacktestRefResponseDtoBuilder? lastBacktestRef,
  ) => _$this._lastBacktestRef = lastBacktestRef;

  String? _canonicalDigest;
  String? get canonicalDigest => _$this._canonicalDigest;
  set canonicalDigest(String? canonicalDigest) =>
      _$this._canonicalDigest = canonicalDigest;

  MapBuilder<String, JsonObject?>? _specDesc;
  MapBuilder<String, JsonObject?> get specDesc =>
      _$this._specDesc ??= MapBuilder<String, JsonObject?>();
  set specDesc(MapBuilder<String, JsonObject?>? specDesc) =>
      _$this._specDesc = specDesc;

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

  String? _strategyInstanceId;
  String? get strategyInstanceId => _$this._strategyInstanceId;
  set strategyInstanceId(String? strategyInstanceId) =>
      _$this._strategyInstanceId = strategyInstanceId;

  String? _rejectReason;
  String? get rejectReason => _$this._rejectReason;
  set rejectReason(String? rejectReason) => _$this._rejectReason = rejectReason;

  AiQuantConversationResponseDtoBuilder() {
    AiQuantConversationResponseDto._defaults(this);
  }

  AiQuantConversationResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _activeCodegenSessionId = $v.activeCodegenSessionId;
      _conversationTitle = $v.conversationTitle;
      _conversationMessages = $v.conversationMessages?.toBuilder();
      _status = $v.status;
      _createdAt = $v.createdAt;
      _updatedAt = $v.updatedAt;
      _backtestDraftConfig = $v.backtestDraftConfig?.toBuilder();
      _lastBacktestRef = $v.lastBacktestRef?.toBuilder();
      _canonicalDigest = $v.canonicalDigest;
      _specDesc = $v.specDesc?.toBuilder();
      _semanticGraph = $v.semanticGraph?.toBuilder();
      _validationReport = $v.validationReport?.toBuilder();
      _clarificationGate = $v.clarificationGate?.toBuilder();
      _publicationGate = $v.publicationGate?.toBuilder();
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
      _strategyInstanceId = $v.strategyInstanceId;
      _rejectReason = $v.rejectReason;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AiQuantConversationResponseDto other) {
    _$v = other as _$AiQuantConversationResponseDto;
  }

  @override
  void update(void Function(AiQuantConversationResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AiQuantConversationResponseDto build() => _build();

  _$AiQuantConversationResponseDto _build() {
    _$AiQuantConversationResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$AiQuantConversationResponseDto._(
            id: BuiltValueNullFieldError.checkNotNull(
              id,
              r'AiQuantConversationResponseDto',
              'id',
            ),
            activeCodegenSessionId: activeCodegenSessionId,
            conversationTitle: conversationTitle,
            conversationMessages: _conversationMessages?.build(),
            status: status,
            createdAt: createdAt,
            updatedAt: updatedAt,
            backtestDraftConfig: _backtestDraftConfig?.build(),
            lastBacktestRef: _lastBacktestRef?.build(),
            canonicalDigest: canonicalDigest,
            specDesc: _specDesc?.build(),
            semanticGraph: _semanticGraph?.build(),
            validationReport: _validationReport?.build(),
            clarificationGate: _clarificationGate?.build(),
            publicationGate: _publicationGate?.build(),
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
            strategyInstanceId: strategyInstanceId,
            rejectReason: rejectReason,
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'conversationMessages';
        _conversationMessages?.build();

        _$failedField = 'backtestDraftConfig';
        _backtestDraftConfig?.build();
        _$failedField = 'lastBacktestRef';
        _lastBacktestRef?.build();

        _$failedField = 'specDesc';
        _specDesc?.build();
        _$failedField = 'semanticGraph';
        _semanticGraph?.build();
        _$failedField = 'validationReport';
        _validationReport?.build();
        _$failedField = 'clarificationGate';
        _clarificationGate?.build();
        _$failedField = 'publicationGate';
        _publicationGate?.build();

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
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AiQuantConversationResponseDto',
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
