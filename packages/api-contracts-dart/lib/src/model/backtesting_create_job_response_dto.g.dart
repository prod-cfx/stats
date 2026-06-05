// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'backtesting_create_job_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const BacktestingCreateJobResponseDtoStatusEnum
_$backtestingCreateJobResponseDtoStatusEnum_queued =
    const BacktestingCreateJobResponseDtoStatusEnum._('queued');
const BacktestingCreateJobResponseDtoStatusEnum
_$backtestingCreateJobResponseDtoStatusEnum_running =
    const BacktestingCreateJobResponseDtoStatusEnum._('running');
const BacktestingCreateJobResponseDtoStatusEnum
_$backtestingCreateJobResponseDtoStatusEnum_succeeded =
    const BacktestingCreateJobResponseDtoStatusEnum._('succeeded');
const BacktestingCreateJobResponseDtoStatusEnum
_$backtestingCreateJobResponseDtoStatusEnum_failed =
    const BacktestingCreateJobResponseDtoStatusEnum._('failed');

BacktestingCreateJobResponseDtoStatusEnum
_$backtestingCreateJobResponseDtoStatusEnumValueOf(String name) {
  switch (name) {
    case 'queued':
      return _$backtestingCreateJobResponseDtoStatusEnum_queued;
    case 'running':
      return _$backtestingCreateJobResponseDtoStatusEnum_running;
    case 'succeeded':
      return _$backtestingCreateJobResponseDtoStatusEnum_succeeded;
    case 'failed':
      return _$backtestingCreateJobResponseDtoStatusEnum_failed;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<BacktestingCreateJobResponseDtoStatusEnum>
_$backtestingCreateJobResponseDtoStatusEnumValues =
    BuiltSet<BacktestingCreateJobResponseDtoStatusEnum>(
      const <BacktestingCreateJobResponseDtoStatusEnum>[
        _$backtestingCreateJobResponseDtoStatusEnum_queued,
        _$backtestingCreateJobResponseDtoStatusEnum_running,
        _$backtestingCreateJobResponseDtoStatusEnum_succeeded,
        _$backtestingCreateJobResponseDtoStatusEnum_failed,
      ],
    );

Serializer<BacktestingCreateJobResponseDtoStatusEnum>
_$backtestingCreateJobResponseDtoStatusEnumSerializer =
    _$BacktestingCreateJobResponseDtoStatusEnumSerializer();

class _$BacktestingCreateJobResponseDtoStatusEnumSerializer
    implements PrimitiveSerializer<BacktestingCreateJobResponseDtoStatusEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'queued': 'queued',
    'running': 'running',
    'succeeded': 'succeeded',
    'failed': 'failed',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'queued': 'queued',
    'running': 'running',
    'succeeded': 'succeeded',
    'failed': 'failed',
  };

  @override
  final Iterable<Type> types = const <Type>[
    BacktestingCreateJobResponseDtoStatusEnum,
  ];
  @override
  final String wireName = 'BacktestingCreateJobResponseDtoStatusEnum';

  @override
  Object serialize(
    Serializers serializers,
    BacktestingCreateJobResponseDtoStatusEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  BacktestingCreateJobResponseDtoStatusEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => BacktestingCreateJobResponseDtoStatusEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$BacktestingCreateJobResponseDto
    extends BacktestingCreateJobResponseDto {
  @override
  final String id;
  @override
  final BacktestingCreateJobResponseDtoStatusEnum status;
  @override
  final String createdAt;
  @override
  final String? startedAt;
  @override
  final String? finishedAt;
  @override
  final String? error;
  @override
  final BacktestingCreateJobErrorDetailsDto? errorDetails;
  @override
  final BacktestingCreateJobInputSummaryDto inputSummary;
  @override
  final BacktestingCreateJobSummaryDto? resultSummary;

  factory _$BacktestingCreateJobResponseDto([
    void Function(BacktestingCreateJobResponseDtoBuilder)? updates,
  ]) => (BacktestingCreateJobResponseDtoBuilder()..update(updates))._build();

  _$BacktestingCreateJobResponseDto._({
    required this.id,
    required this.status,
    required this.createdAt,
    this.startedAt,
    this.finishedAt,
    this.error,
    this.errorDetails,
    required this.inputSummary,
    this.resultSummary,
  }) : super._();
  @override
  BacktestingCreateJobResponseDto rebuild(
    void Function(BacktestingCreateJobResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  BacktestingCreateJobResponseDtoBuilder toBuilder() =>
      BacktestingCreateJobResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is BacktestingCreateJobResponseDto &&
        id == other.id &&
        status == other.status &&
        createdAt == other.createdAt &&
        startedAt == other.startedAt &&
        finishedAt == other.finishedAt &&
        error == other.error &&
        errorDetails == other.errorDetails &&
        inputSummary == other.inputSummary &&
        resultSummary == other.resultSummary;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jc(_$hash, startedAt.hashCode);
    _$hash = $jc(_$hash, finishedAt.hashCode);
    _$hash = $jc(_$hash, error.hashCode);
    _$hash = $jc(_$hash, errorDetails.hashCode);
    _$hash = $jc(_$hash, inputSummary.hashCode);
    _$hash = $jc(_$hash, resultSummary.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'BacktestingCreateJobResponseDto')
          ..add('id', id)
          ..add('status', status)
          ..add('createdAt', createdAt)
          ..add('startedAt', startedAt)
          ..add('finishedAt', finishedAt)
          ..add('error', error)
          ..add('errorDetails', errorDetails)
          ..add('inputSummary', inputSummary)
          ..add('resultSummary', resultSummary))
        .toString();
  }
}

class BacktestingCreateJobResponseDtoBuilder
    implements
        Builder<
          BacktestingCreateJobResponseDto,
          BacktestingCreateJobResponseDtoBuilder
        > {
  _$BacktestingCreateJobResponseDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  BacktestingCreateJobResponseDtoStatusEnum? _status;
  BacktestingCreateJobResponseDtoStatusEnum? get status => _$this._status;
  set status(BacktestingCreateJobResponseDtoStatusEnum? status) =>
      _$this._status = status;

  String? _createdAt;
  String? get createdAt => _$this._createdAt;
  set createdAt(String? createdAt) => _$this._createdAt = createdAt;

  String? _startedAt;
  String? get startedAt => _$this._startedAt;
  set startedAt(String? startedAt) => _$this._startedAt = startedAt;

  String? _finishedAt;
  String? get finishedAt => _$this._finishedAt;
  set finishedAt(String? finishedAt) => _$this._finishedAt = finishedAt;

  String? _error;
  String? get error => _$this._error;
  set error(String? error) => _$this._error = error;

  BacktestingCreateJobErrorDetailsDtoBuilder? _errorDetails;
  BacktestingCreateJobErrorDetailsDtoBuilder get errorDetails =>
      _$this._errorDetails ??= BacktestingCreateJobErrorDetailsDtoBuilder();
  set errorDetails(BacktestingCreateJobErrorDetailsDtoBuilder? errorDetails) =>
      _$this._errorDetails = errorDetails;

  BacktestingCreateJobInputSummaryDtoBuilder? _inputSummary;
  BacktestingCreateJobInputSummaryDtoBuilder get inputSummary =>
      _$this._inputSummary ??= BacktestingCreateJobInputSummaryDtoBuilder();
  set inputSummary(BacktestingCreateJobInputSummaryDtoBuilder? inputSummary) =>
      _$this._inputSummary = inputSummary;

  BacktestingCreateJobSummaryDtoBuilder? _resultSummary;
  BacktestingCreateJobSummaryDtoBuilder get resultSummary =>
      _$this._resultSummary ??= BacktestingCreateJobSummaryDtoBuilder();
  set resultSummary(BacktestingCreateJobSummaryDtoBuilder? resultSummary) =>
      _$this._resultSummary = resultSummary;

  BacktestingCreateJobResponseDtoBuilder() {
    BacktestingCreateJobResponseDto._defaults(this);
  }

  BacktestingCreateJobResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _status = $v.status;
      _createdAt = $v.createdAt;
      _startedAt = $v.startedAt;
      _finishedAt = $v.finishedAt;
      _error = $v.error;
      _errorDetails = $v.errorDetails?.toBuilder();
      _inputSummary = $v.inputSummary.toBuilder();
      _resultSummary = $v.resultSummary?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(BacktestingCreateJobResponseDto other) {
    _$v = other as _$BacktestingCreateJobResponseDto;
  }

  @override
  void update(void Function(BacktestingCreateJobResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  BacktestingCreateJobResponseDto build() => _build();

  _$BacktestingCreateJobResponseDto _build() {
    _$BacktestingCreateJobResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$BacktestingCreateJobResponseDto._(
            id: BuiltValueNullFieldError.checkNotNull(
              id,
              r'BacktestingCreateJobResponseDto',
              'id',
            ),
            status: BuiltValueNullFieldError.checkNotNull(
              status,
              r'BacktestingCreateJobResponseDto',
              'status',
            ),
            createdAt: BuiltValueNullFieldError.checkNotNull(
              createdAt,
              r'BacktestingCreateJobResponseDto',
              'createdAt',
            ),
            startedAt: startedAt,
            finishedAt: finishedAt,
            error: error,
            errorDetails: _errorDetails?.build(),
            inputSummary: inputSummary.build(),
            resultSummary: _resultSummary?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'errorDetails';
        _errorDetails?.build();
        _$failedField = 'inputSummary';
        inputSummary.build();
        _$failedField = 'resultSummary';
        _resultSummary?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'BacktestingCreateJobResponseDto',
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
