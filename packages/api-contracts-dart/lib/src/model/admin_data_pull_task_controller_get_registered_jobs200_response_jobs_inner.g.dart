// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_data_pull_task_controller_get_registered_jobs200_response_jobs_inner.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner
    extends AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner {
  @override
  final String? key;
  @override
  final String? name;
  @override
  final AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema?
  metaSchema;

  factory _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner([
    void Function(
      AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerBuilder,
    )?
    updates,
  ]) =>
      (AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerBuilder()
            ..update(updates))
          ._build();

  _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner._({
    this.key,
    this.name,
    this.metaSchema,
  }) : super._();
  @override
  AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner rebuild(
    void Function(
      AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerBuilder,
    )
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerBuilder
  toBuilder() =>
      AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other
            is AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner &&
        key == other.key &&
        name == other.name &&
        metaSchema == other.metaSchema;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, key.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, metaSchema.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner',
          )
          ..add('key', key)
          ..add('name', name)
          ..add('metaSchema', metaSchema))
        .toString();
  }
}

class AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerBuilder
    implements
        Builder<
          AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner,
          AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerBuilder
        > {
  _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner? _$v;

  String? _key;
  String? get key => _$this._key;
  set key(String? key) => _$this._key = key;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchemaBuilder?
  _metaSchema;
  AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchemaBuilder
  get metaSchema => _$this._metaSchema ??=
      AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchemaBuilder();
  set metaSchema(
    AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchemaBuilder?
    metaSchema,
  ) => _$this._metaSchema = metaSchema;

  AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerBuilder() {
    AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner._defaults(
      this,
    );
  }

  AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerBuilder
  get _$this {
    final $v = _$v;
    if ($v != null) {
      _key = $v.key;
      _name = $v.name;
      _metaSchema = $v.metaSchema?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(
    AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner other,
  ) {
    _$v =
        other
            as _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner;
  }

  @override
  void update(
    void Function(
      AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerBuilder,
    )?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner build() =>
      _build();

  _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner _build() {
    _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner _$result;
    try {
      _$result =
          _$v ??
          _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner._(
            key: key,
            name: name,
            metaSchema: _metaSchema?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'metaSchema';
        _metaSchema?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner',
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
