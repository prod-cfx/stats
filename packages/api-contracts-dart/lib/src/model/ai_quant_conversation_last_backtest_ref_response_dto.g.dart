// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ai_quant_conversation_last_backtest_ref_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AiQuantConversationLastBacktestRefResponseDto
    extends AiQuantConversationLastBacktestRefResponseDto {
  @override
  final String jobId;
  @override
  final String publishedSnapshotId;
  @override
  final AiQuantConversationBacktestConfigResponseDto config;
  @override
  final AiQuantConversationLastBacktestSummaryResponseDto summary;
  @override
  final String completedAt;

  factory _$AiQuantConversationLastBacktestRefResponseDto([
    void Function(AiQuantConversationLastBacktestRefResponseDtoBuilder)?
    updates,
  ]) =>
      (AiQuantConversationLastBacktestRefResponseDtoBuilder()..update(updates))
          ._build();

  _$AiQuantConversationLastBacktestRefResponseDto._({
    required this.jobId,
    required this.publishedSnapshotId,
    required this.config,
    required this.summary,
    required this.completedAt,
  }) : super._();
  @override
  AiQuantConversationLastBacktestRefResponseDto rebuild(
    void Function(AiQuantConversationLastBacktestRefResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AiQuantConversationLastBacktestRefResponseDtoBuilder toBuilder() =>
      AiQuantConversationLastBacktestRefResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AiQuantConversationLastBacktestRefResponseDto &&
        jobId == other.jobId &&
        publishedSnapshotId == other.publishedSnapshotId &&
        config == other.config &&
        summary == other.summary &&
        completedAt == other.completedAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, jobId.hashCode);
    _$hash = $jc(_$hash, publishedSnapshotId.hashCode);
    _$hash = $jc(_$hash, config.hashCode);
    _$hash = $jc(_$hash, summary.hashCode);
    _$hash = $jc(_$hash, completedAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'AiQuantConversationLastBacktestRefResponseDto',
          )
          ..add('jobId', jobId)
          ..add('publishedSnapshotId', publishedSnapshotId)
          ..add('config', config)
          ..add('summary', summary)
          ..add('completedAt', completedAt))
        .toString();
  }
}

class AiQuantConversationLastBacktestRefResponseDtoBuilder
    implements
        Builder<
          AiQuantConversationLastBacktestRefResponseDto,
          AiQuantConversationLastBacktestRefResponseDtoBuilder
        > {
  _$AiQuantConversationLastBacktestRefResponseDto? _$v;

  String? _jobId;
  String? get jobId => _$this._jobId;
  set jobId(String? jobId) => _$this._jobId = jobId;

  String? _publishedSnapshotId;
  String? get publishedSnapshotId => _$this._publishedSnapshotId;
  set publishedSnapshotId(String? publishedSnapshotId) =>
      _$this._publishedSnapshotId = publishedSnapshotId;

  AiQuantConversationBacktestConfigResponseDtoBuilder? _config;
  AiQuantConversationBacktestConfigResponseDtoBuilder get config =>
      _$this._config ??= AiQuantConversationBacktestConfigResponseDtoBuilder();
  set config(AiQuantConversationBacktestConfigResponseDtoBuilder? config) =>
      _$this._config = config;

  AiQuantConversationLastBacktestSummaryResponseDtoBuilder? _summary;
  AiQuantConversationLastBacktestSummaryResponseDtoBuilder get summary =>
      _$this._summary ??=
          AiQuantConversationLastBacktestSummaryResponseDtoBuilder();
  set summary(
    AiQuantConversationLastBacktestSummaryResponseDtoBuilder? summary,
  ) => _$this._summary = summary;

  String? _completedAt;
  String? get completedAt => _$this._completedAt;
  set completedAt(String? completedAt) => _$this._completedAt = completedAt;

  AiQuantConversationLastBacktestRefResponseDtoBuilder() {
    AiQuantConversationLastBacktestRefResponseDto._defaults(this);
  }

  AiQuantConversationLastBacktestRefResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _jobId = $v.jobId;
      _publishedSnapshotId = $v.publishedSnapshotId;
      _config = $v.config.toBuilder();
      _summary = $v.summary.toBuilder();
      _completedAt = $v.completedAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AiQuantConversationLastBacktestRefResponseDto other) {
    _$v = other as _$AiQuantConversationLastBacktestRefResponseDto;
  }

  @override
  void update(
    void Function(AiQuantConversationLastBacktestRefResponseDtoBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AiQuantConversationLastBacktestRefResponseDto build() => _build();

  _$AiQuantConversationLastBacktestRefResponseDto _build() {
    _$AiQuantConversationLastBacktestRefResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$AiQuantConversationLastBacktestRefResponseDto._(
            jobId: BuiltValueNullFieldError.checkNotNull(
              jobId,
              r'AiQuantConversationLastBacktestRefResponseDto',
              'jobId',
            ),
            publishedSnapshotId: BuiltValueNullFieldError.checkNotNull(
              publishedSnapshotId,
              r'AiQuantConversationLastBacktestRefResponseDto',
              'publishedSnapshotId',
            ),
            config: config.build(),
            summary: summary.build(),
            completedAt: BuiltValueNullFieldError.checkNotNull(
              completedAt,
              r'AiQuantConversationLastBacktestRefResponseDto',
              'completedAt',
            ),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'config';
        config.build();
        _$failedField = 'summary';
        summary.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AiQuantConversationLastBacktestRefResponseDto',
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
