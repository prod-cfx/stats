// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_settings_controller_reload_settings200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminSettingsControllerReloadSettings200Response
    extends AdminSettingsControllerReloadSettings200Response {
  @override
  final AdminSettingsControllerReloadSettings200ResponseData? data;
  @override
  final String? message;

  factory _$AdminSettingsControllerReloadSettings200Response([
    void Function(AdminSettingsControllerReloadSettings200ResponseBuilder)?
    updates,
  ]) =>
      (AdminSettingsControllerReloadSettings200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AdminSettingsControllerReloadSettings200Response._({
    this.data,
    this.message,
  }) : super._();
  @override
  AdminSettingsControllerReloadSettings200Response rebuild(
    void Function(AdminSettingsControllerReloadSettings200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminSettingsControllerReloadSettings200ResponseBuilder toBuilder() =>
      AdminSettingsControllerReloadSettings200ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminSettingsControllerReloadSettings200Response &&
        data == other.data &&
        message == other.message;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, data.hashCode);
    _$hash = $jc(_$hash, message.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'AdminSettingsControllerReloadSettings200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class AdminSettingsControllerReloadSettings200ResponseBuilder
    implements
        Builder<
          AdminSettingsControllerReloadSettings200Response,
          AdminSettingsControllerReloadSettings200ResponseBuilder
        > {
  _$AdminSettingsControllerReloadSettings200Response? _$v;

  AdminSettingsControllerReloadSettings200ResponseDataBuilder? _data;
  AdminSettingsControllerReloadSettings200ResponseDataBuilder get data =>
      _$this._data ??=
          AdminSettingsControllerReloadSettings200ResponseDataBuilder();
  set data(AdminSettingsControllerReloadSettings200ResponseDataBuilder? data) =>
      _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  AdminSettingsControllerReloadSettings200ResponseBuilder() {
    AdminSettingsControllerReloadSettings200Response._defaults(this);
  }

  AdminSettingsControllerReloadSettings200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data?.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminSettingsControllerReloadSettings200Response other) {
    _$v = other as _$AdminSettingsControllerReloadSettings200Response;
  }

  @override
  void update(
    void Function(AdminSettingsControllerReloadSettings200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AdminSettingsControllerReloadSettings200Response build() => _build();

  _$AdminSettingsControllerReloadSettings200Response _build() {
    _$AdminSettingsControllerReloadSettings200Response _$result;
    try {
      _$result =
          _$v ??
          _$AdminSettingsControllerReloadSettings200Response._(
            data: _data?.build(),
            message: message,
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'data';
        _data?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AdminSettingsControllerReloadSettings200Response',
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
