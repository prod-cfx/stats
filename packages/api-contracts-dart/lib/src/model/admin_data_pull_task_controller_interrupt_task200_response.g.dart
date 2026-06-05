// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_data_pull_task_controller_interrupt_task200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminDataPullTaskControllerInterruptTask200Response
    extends AdminDataPullTaskControllerInterruptTask200Response {
  @override
  final bool? success;
  @override
  final String? message;

  factory _$AdminDataPullTaskControllerInterruptTask200Response([
    void Function(AdminDataPullTaskControllerInterruptTask200ResponseBuilder)?
    updates,
  ]) =>
      (AdminDataPullTaskControllerInterruptTask200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AdminDataPullTaskControllerInterruptTask200Response._({
    this.success,
    this.message,
  }) : super._();
  @override
  AdminDataPullTaskControllerInterruptTask200Response rebuild(
    void Function(AdminDataPullTaskControllerInterruptTask200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminDataPullTaskControllerInterruptTask200ResponseBuilder toBuilder() =>
      AdminDataPullTaskControllerInterruptTask200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminDataPullTaskControllerInterruptTask200Response &&
        success == other.success &&
        message == other.message;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, success.hashCode);
    _$hash = $jc(_$hash, message.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'AdminDataPullTaskControllerInterruptTask200Response',
          )
          ..add('success', success)
          ..add('message', message))
        .toString();
  }
}

class AdminDataPullTaskControllerInterruptTask200ResponseBuilder
    implements
        Builder<
          AdminDataPullTaskControllerInterruptTask200Response,
          AdminDataPullTaskControllerInterruptTask200ResponseBuilder
        > {
  _$AdminDataPullTaskControllerInterruptTask200Response? _$v;

  bool? _success;
  bool? get success => _$this._success;
  set success(bool? success) => _$this._success = success;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  AdminDataPullTaskControllerInterruptTask200ResponseBuilder() {
    AdminDataPullTaskControllerInterruptTask200Response._defaults(this);
  }

  AdminDataPullTaskControllerInterruptTask200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _success = $v.success;
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminDataPullTaskControllerInterruptTask200Response other) {
    _$v = other as _$AdminDataPullTaskControllerInterruptTask200Response;
  }

  @override
  void update(
    void Function(AdminDataPullTaskControllerInterruptTask200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AdminDataPullTaskControllerInterruptTask200Response build() => _build();

  _$AdminDataPullTaskControllerInterruptTask200Response _build() {
    final _$result =
        _$v ??
        _$AdminDataPullTaskControllerInterruptTask200Response._(
          success: success,
          message: message,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
