// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'backtesting_job_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const BacktestingJobResponseDtoStatusEnum
_$backtestingJobResponseDtoStatusEnum_queued =
    const BacktestingJobResponseDtoStatusEnum._('queued');
const BacktestingJobResponseDtoStatusEnum
_$backtestingJobResponseDtoStatusEnum_running =
    const BacktestingJobResponseDtoStatusEnum._('running');
const BacktestingJobResponseDtoStatusEnum
_$backtestingJobResponseDtoStatusEnum_succeeded =
    const BacktestingJobResponseDtoStatusEnum._('succeeded');
const BacktestingJobResponseDtoStatusEnum
_$backtestingJobResponseDtoStatusEnum_failed =
    const BacktestingJobResponseDtoStatusEnum._('failed');

BacktestingJobResponseDtoStatusEnum
_$backtestingJobResponseDtoStatusEnumValueOf(String name) {
  switch (name) {
    case 'queued':
      return _$backtestingJobResponseDtoStatusEnum_queued;
    case 'running':
      return _$backtestingJobResponseDtoStatusEnum_running;
    case 'succeeded':
      return _$backtestingJobResponseDtoStatusEnum_succeeded;
    case 'failed':
      return _$backtestingJobResponseDtoStatusEnum_failed;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<BacktestingJobResponseDtoStatusEnum>
_$backtestingJobResponseDtoStatusEnumValues =
    BuiltSet<BacktestingJobResponseDtoStatusEnum>(
      const <BacktestingJobResponseDtoStatusEnum>[
        _$backtestingJobResponseDtoStatusEnum_queued,
        _$backtestingJobResponseDtoStatusEnum_running,
        _$backtestingJobResponseDtoStatusEnum_succeeded,
        _$backtestingJobResponseDtoStatusEnum_failed,
      ],
    );

Serializer<BacktestingJobResponseDtoStatusEnum>
_$backtestingJobResponseDtoStatusEnumSerializer =
    _$BacktestingJobResponseDtoStatusEnumSerializer();

class _$BacktestingJobResponseDtoStatusEnumSerializer
    implements PrimitiveSerializer<BacktestingJobResponseDtoStatusEnum> {
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
    BacktestingJobResponseDtoStatusEnum,
  ];
  @override
  final String wireName = 'BacktestingJobResponseDtoStatusEnum';

  @override
  Object serialize(
    Serializers serializers,
    BacktestingJobResponseDtoStatusEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  BacktestingJobResponseDtoStatusEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => BacktestingJobResponseDtoStatusEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$BacktestingJobResponseDto extends BacktestingJobResponseDto {
  @override
  final String id;
  @override
  final BacktestingJobResponseDtoStatusEnum status;
  @override
  final String createdAt;
  @override
  final String? startedAt;
  @override
  final String? finishedAt;
  @override
  final String? error;
  @override
  final BuiltMap<String, JsonObject?>? errorDetails;
  @override
  final BuiltMap<String, JsonObject?> inputSummary;
  @override
  final BuiltMap<String, JsonObject?>? resultSummary;

  factory _$BacktestingJobResponseDto([
    void Function(BacktestingJobResponseDtoBuilder)? updates,
  ]) => (BacktestingJobResponseDtoBuilder()..update(updates))._build();

  _$BacktestingJobResponseDto._({
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
  BacktestingJobResponseDto rebuild(
    void Function(BacktestingJobResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  BacktestingJobResponseDtoBuilder toBuilder() =>
      BacktestingJobResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is BacktestingJobResponseDto &&
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
    return (newBuiltValueToStringHelper(r'BacktestingJobResponseDto')
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

class BacktestingJobResponseDtoBuilder
    implements
        Builder<BacktestingJobResponseDto, BacktestingJobResponseDtoBuilder> {
  _$BacktestingJobResponseDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  BacktestingJobResponseDtoStatusEnum? _status;
  BacktestingJobResponseDtoStatusEnum? get status => _$this._status;
  set status(BacktestingJobResponseDtoStatusEnum? status) =>
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

  MapBuilder<String, JsonObject?>? _errorDetails;
  MapBuilder<String, JsonObject?> get errorDetails =>
      _$this._errorDetails ??= MapBuilder<String, JsonObject?>();
  set errorDetails(MapBuilder<String, JsonObject?>? errorDetails) =>
      _$this._errorDetails = errorDetails;

  MapBuilder<String, JsonObject?>? _inputSummary;
  MapBuilder<String, JsonObject?> get inputSummary =>
      _$this._inputSummary ??= MapBuilder<String, JsonObject?>();
  set inputSummary(MapBuilder<String, JsonObject?>? inputSummary) =>
      _$this._inputSummary = inputSummary;

  MapBuilder<String, JsonObject?>? _resultSummary;
  MapBuilder<String, JsonObject?> get resultSummary =>
      _$this._resultSummary ??= MapBuilder<String, JsonObject?>();
  set resultSummary(MapBuilder<String, JsonObject?>? resultSummary) =>
      _$this._resultSummary = resultSummary;

  BacktestingJobResponseDtoBuilder() {
    BacktestingJobResponseDto._defaults(this);
  }

  BacktestingJobResponseDtoBuilder get _$this {
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
  void replace(BacktestingJobResponseDto other) {
    _$v = other as _$BacktestingJobResponseDto;
  }

  @override
  void update(void Function(BacktestingJobResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  BacktestingJobResponseDto build() => _build();

  _$BacktestingJobResponseDto _build() {
    _$BacktestingJobResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$BacktestingJobResponseDto._(
            id: BuiltValueNullFieldError.checkNotNull(
              id,
              r'BacktestingJobResponseDto',
              'id',
            ),
            status: BuiltValueNullFieldError.checkNotNull(
              status,
              r'BacktestingJobResponseDto',
              'status',
            ),
            createdAt: BuiltValueNullFieldError.checkNotNull(
              createdAt,
              r'BacktestingJobResponseDto',
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
          r'BacktestingJobResponseDto',
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
