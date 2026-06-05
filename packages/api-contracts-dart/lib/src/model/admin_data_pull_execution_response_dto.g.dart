// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_data_pull_execution_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminDataPullExecutionResponseDto
    extends AdminDataPullExecutionResponseDto {
  @override
  final num id;
  @override
  final num taskId;
  @override
  final String status;
  @override
  final num fetchedCount;
  @override
  final DateTime startedAt;
  @override
  final DateTime? finishedAt;
  @override
  final String? errorMessage;
  @override
  final JsonObject? meta;

  factory _$AdminDataPullExecutionResponseDto([
    void Function(AdminDataPullExecutionResponseDtoBuilder)? updates,
  ]) => (AdminDataPullExecutionResponseDtoBuilder()..update(updates))._build();

  _$AdminDataPullExecutionResponseDto._({
    required this.id,
    required this.taskId,
    required this.status,
    required this.fetchedCount,
    required this.startedAt,
    this.finishedAt,
    this.errorMessage,
    this.meta,
  }) : super._();
  @override
  AdminDataPullExecutionResponseDto rebuild(
    void Function(AdminDataPullExecutionResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminDataPullExecutionResponseDtoBuilder toBuilder() =>
      AdminDataPullExecutionResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminDataPullExecutionResponseDto &&
        id == other.id &&
        taskId == other.taskId &&
        status == other.status &&
        fetchedCount == other.fetchedCount &&
        startedAt == other.startedAt &&
        finishedAt == other.finishedAt &&
        errorMessage == other.errorMessage &&
        meta == other.meta;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, taskId.hashCode);
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jc(_$hash, fetchedCount.hashCode);
    _$hash = $jc(_$hash, startedAt.hashCode);
    _$hash = $jc(_$hash, finishedAt.hashCode);
    _$hash = $jc(_$hash, errorMessage.hashCode);
    _$hash = $jc(_$hash, meta.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AdminDataPullExecutionResponseDto')
          ..add('id', id)
          ..add('taskId', taskId)
          ..add('status', status)
          ..add('fetchedCount', fetchedCount)
          ..add('startedAt', startedAt)
          ..add('finishedAt', finishedAt)
          ..add('errorMessage', errorMessage)
          ..add('meta', meta))
        .toString();
  }
}

class AdminDataPullExecutionResponseDtoBuilder
    implements
        Builder<
          AdminDataPullExecutionResponseDto,
          AdminDataPullExecutionResponseDtoBuilder
        > {
  _$AdminDataPullExecutionResponseDto? _$v;

  num? _id;
  num? get id => _$this._id;
  set id(num? id) => _$this._id = id;

  num? _taskId;
  num? get taskId => _$this._taskId;
  set taskId(num? taskId) => _$this._taskId = taskId;

  String? _status;
  String? get status => _$this._status;
  set status(String? status) => _$this._status = status;

  num? _fetchedCount;
  num? get fetchedCount => _$this._fetchedCount;
  set fetchedCount(num? fetchedCount) => _$this._fetchedCount = fetchedCount;

  DateTime? _startedAt;
  DateTime? get startedAt => _$this._startedAt;
  set startedAt(DateTime? startedAt) => _$this._startedAt = startedAt;

  DateTime? _finishedAt;
  DateTime? get finishedAt => _$this._finishedAt;
  set finishedAt(DateTime? finishedAt) => _$this._finishedAt = finishedAt;

  String? _errorMessage;
  String? get errorMessage => _$this._errorMessage;
  set errorMessage(String? errorMessage) => _$this._errorMessage = errorMessage;

  JsonObject? _meta;
  JsonObject? get meta => _$this._meta;
  set meta(JsonObject? meta) => _$this._meta = meta;

  AdminDataPullExecutionResponseDtoBuilder() {
    AdminDataPullExecutionResponseDto._defaults(this);
  }

  AdminDataPullExecutionResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _taskId = $v.taskId;
      _status = $v.status;
      _fetchedCount = $v.fetchedCount;
      _startedAt = $v.startedAt;
      _finishedAt = $v.finishedAt;
      _errorMessage = $v.errorMessage;
      _meta = $v.meta;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminDataPullExecutionResponseDto other) {
    _$v = other as _$AdminDataPullExecutionResponseDto;
  }

  @override
  void update(
    void Function(AdminDataPullExecutionResponseDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AdminDataPullExecutionResponseDto build() => _build();

  _$AdminDataPullExecutionResponseDto _build() {
    final _$result =
        _$v ??
        _$AdminDataPullExecutionResponseDto._(
          id: BuiltValueNullFieldError.checkNotNull(
            id,
            r'AdminDataPullExecutionResponseDto',
            'id',
          ),
          taskId: BuiltValueNullFieldError.checkNotNull(
            taskId,
            r'AdminDataPullExecutionResponseDto',
            'taskId',
          ),
          status: BuiltValueNullFieldError.checkNotNull(
            status,
            r'AdminDataPullExecutionResponseDto',
            'status',
          ),
          fetchedCount: BuiltValueNullFieldError.checkNotNull(
            fetchedCount,
            r'AdminDataPullExecutionResponseDto',
            'fetchedCount',
          ),
          startedAt: BuiltValueNullFieldError.checkNotNull(
            startedAt,
            r'AdminDataPullExecutionResponseDto',
            'startedAt',
          ),
          finishedAt: finishedAt,
          errorMessage: errorMessage,
          meta: meta,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
