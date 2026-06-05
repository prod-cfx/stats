// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_data_pull_task_controller_get_registered_jobs200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminDataPullTaskControllerGetRegisteredJobs200Response
    extends AdminDataPullTaskControllerGetRegisteredJobs200Response {
  @override
  final BuiltList<
    AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner
  >?
  jobs;

  factory _$AdminDataPullTaskControllerGetRegisteredJobs200Response([
    void Function(
      AdminDataPullTaskControllerGetRegisteredJobs200ResponseBuilder,
    )?
    updates,
  ]) =>
      (AdminDataPullTaskControllerGetRegisteredJobs200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AdminDataPullTaskControllerGetRegisteredJobs200Response._({this.jobs})
    : super._();
  @override
  AdminDataPullTaskControllerGetRegisteredJobs200Response rebuild(
    void Function(
      AdminDataPullTaskControllerGetRegisteredJobs200ResponseBuilder,
    )
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminDataPullTaskControllerGetRegisteredJobs200ResponseBuilder toBuilder() =>
      AdminDataPullTaskControllerGetRegisteredJobs200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminDataPullTaskControllerGetRegisteredJobs200Response &&
        jobs == other.jobs;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, jobs.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'AdminDataPullTaskControllerGetRegisteredJobs200Response',
    )..add('jobs', jobs)).toString();
  }
}

class AdminDataPullTaskControllerGetRegisteredJobs200ResponseBuilder
    implements
        Builder<
          AdminDataPullTaskControllerGetRegisteredJobs200Response,
          AdminDataPullTaskControllerGetRegisteredJobs200ResponseBuilder
        > {
  _$AdminDataPullTaskControllerGetRegisteredJobs200Response? _$v;

  ListBuilder<AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner>?
  _jobs;
  ListBuilder<AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner>
  get jobs => _$this._jobs ??=
      ListBuilder<
        AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner
      >();
  set jobs(
    ListBuilder<
      AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner
    >?
    jobs,
  ) => _$this._jobs = jobs;

  AdminDataPullTaskControllerGetRegisteredJobs200ResponseBuilder() {
    AdminDataPullTaskControllerGetRegisteredJobs200Response._defaults(this);
  }

  AdminDataPullTaskControllerGetRegisteredJobs200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _jobs = $v.jobs?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminDataPullTaskControllerGetRegisteredJobs200Response other) {
    _$v = other as _$AdminDataPullTaskControllerGetRegisteredJobs200Response;
  }

  @override
  void update(
    void Function(
      AdminDataPullTaskControllerGetRegisteredJobs200ResponseBuilder,
    )?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AdminDataPullTaskControllerGetRegisteredJobs200Response build() => _build();

  _$AdminDataPullTaskControllerGetRegisteredJobs200Response _build() {
    _$AdminDataPullTaskControllerGetRegisteredJobs200Response _$result;
    try {
      _$result =
          _$v ??
          _$AdminDataPullTaskControllerGetRegisteredJobs200Response._(
            jobs: _jobs?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'jobs';
        _jobs?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AdminDataPullTaskControllerGetRegisteredJobs200Response',
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
