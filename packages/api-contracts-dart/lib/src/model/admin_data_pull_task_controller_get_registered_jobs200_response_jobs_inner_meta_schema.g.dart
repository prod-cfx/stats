// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_data_pull_task_controller_get_registered_jobs200_response_jobs_inner_meta_schema.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema
    extends
        AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema {
  @override
  final String? description;
  @override
  final BuiltList<String>? fields;
  @override
  final JsonObject? example;

  factory _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema([
    void Function(
      AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchemaBuilder,
    )?
    updates,
  ]) =>
      (AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchemaBuilder()
            ..update(updates))
          ._build();

  _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema._({
    this.description,
    this.fields,
    this.example,
  }) : super._();
  @override
  AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema
  rebuild(
    void Function(
      AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchemaBuilder,
    )
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchemaBuilder
  toBuilder() =>
      AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchemaBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other
            is AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema &&
        description == other.description &&
        fields == other.fields &&
        example == other.example;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, description.hashCode);
    _$hash = $jc(_$hash, fields.hashCode);
    _$hash = $jc(_$hash, example.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema',
          )
          ..add('description', description)
          ..add('fields', fields)
          ..add('example', example))
        .toString();
  }
}

class AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchemaBuilder
    implements
        Builder<
          AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema,
          AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchemaBuilder
        > {
  _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema?
  _$v;

  String? _description;
  String? get description => _$this._description;
  set description(String? description) => _$this._description = description;

  ListBuilder<String>? _fields;
  ListBuilder<String> get fields => _$this._fields ??= ListBuilder<String>();
  set fields(ListBuilder<String>? fields) => _$this._fields = fields;

  JsonObject? _example;
  JsonObject? get example => _$this._example;
  set example(JsonObject? example) => _$this._example = example;

  AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchemaBuilder() {
    AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema._defaults(
      this,
    );
  }

  AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchemaBuilder
  get _$this {
    final $v = _$v;
    if ($v != null) {
      _description = $v.description;
      _fields = $v.fields?.toBuilder();
      _example = $v.example;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(
    AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema
    other,
  ) {
    _$v =
        other
            as _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema;
  }

  @override
  void update(
    void Function(
      AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchemaBuilder,
    )?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema
  build() => _build();

  _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema
  _build() {
    _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema
    _$result;
    try {
      _$result =
          _$v ??
          _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema
              ._(
                description: description,
                fields: _fields?.build(),
                example: example,
              );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'fields';
        _fields?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema',
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
