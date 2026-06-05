// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_data_pull_task_controller_get_registered_keys200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminDataPullTaskControllerGetRegisteredKeys200Response
    extends AdminDataPullTaskControllerGetRegisteredKeys200Response {
  @override
  final BuiltList<String>? keys;

  factory _$AdminDataPullTaskControllerGetRegisteredKeys200Response([
    void Function(
      AdminDataPullTaskControllerGetRegisteredKeys200ResponseBuilder,
    )?
    updates,
  ]) =>
      (AdminDataPullTaskControllerGetRegisteredKeys200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AdminDataPullTaskControllerGetRegisteredKeys200Response._({this.keys})
    : super._();
  @override
  AdminDataPullTaskControllerGetRegisteredKeys200Response rebuild(
    void Function(
      AdminDataPullTaskControllerGetRegisteredKeys200ResponseBuilder,
    )
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminDataPullTaskControllerGetRegisteredKeys200ResponseBuilder toBuilder() =>
      AdminDataPullTaskControllerGetRegisteredKeys200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminDataPullTaskControllerGetRegisteredKeys200Response &&
        keys == other.keys;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, keys.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'AdminDataPullTaskControllerGetRegisteredKeys200Response',
    )..add('keys', keys)).toString();
  }
}

class AdminDataPullTaskControllerGetRegisteredKeys200ResponseBuilder
    implements
        Builder<
          AdminDataPullTaskControllerGetRegisteredKeys200Response,
          AdminDataPullTaskControllerGetRegisteredKeys200ResponseBuilder
        > {
  _$AdminDataPullTaskControllerGetRegisteredKeys200Response? _$v;

  ListBuilder<String>? _keys;
  ListBuilder<String> get keys => _$this._keys ??= ListBuilder<String>();
  set keys(ListBuilder<String>? keys) => _$this._keys = keys;

  AdminDataPullTaskControllerGetRegisteredKeys200ResponseBuilder() {
    AdminDataPullTaskControllerGetRegisteredKeys200Response._defaults(this);
  }

  AdminDataPullTaskControllerGetRegisteredKeys200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _keys = $v.keys?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminDataPullTaskControllerGetRegisteredKeys200Response other) {
    _$v = other as _$AdminDataPullTaskControllerGetRegisteredKeys200Response;
  }

  @override
  void update(
    void Function(
      AdminDataPullTaskControllerGetRegisteredKeys200ResponseBuilder,
    )?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AdminDataPullTaskControllerGetRegisteredKeys200Response build() => _build();

  _$AdminDataPullTaskControllerGetRegisteredKeys200Response _build() {
    _$AdminDataPullTaskControllerGetRegisteredKeys200Response _$result;
    try {
      _$result =
          _$v ??
          _$AdminDataPullTaskControllerGetRegisteredKeys200Response._(
            keys: _keys?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'keys';
        _keys?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AdminDataPullTaskControllerGetRegisteredKeys200Response',
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
