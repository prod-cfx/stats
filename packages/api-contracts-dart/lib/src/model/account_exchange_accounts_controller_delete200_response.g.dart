// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'account_exchange_accounts_controller_delete200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AccountExchangeAccountsControllerDelete200Response
    extends AccountExchangeAccountsControllerDelete200Response {
  @override
  final AdminSettingsControllerReloadSettings200ResponseData? data;

  factory _$AccountExchangeAccountsControllerDelete200Response([
    void Function(AccountExchangeAccountsControllerDelete200ResponseBuilder)?
    updates,
  ]) =>
      (AccountExchangeAccountsControllerDelete200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AccountExchangeAccountsControllerDelete200Response._({this.data})
    : super._();
  @override
  AccountExchangeAccountsControllerDelete200Response rebuild(
    void Function(AccountExchangeAccountsControllerDelete200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AccountExchangeAccountsControllerDelete200ResponseBuilder toBuilder() =>
      AccountExchangeAccountsControllerDelete200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AccountExchangeAccountsControllerDelete200Response &&
        data == other.data;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, data.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'AccountExchangeAccountsControllerDelete200Response',
    )..add('data', data)).toString();
  }
}

class AccountExchangeAccountsControllerDelete200ResponseBuilder
    implements
        Builder<
          AccountExchangeAccountsControllerDelete200Response,
          AccountExchangeAccountsControllerDelete200ResponseBuilder
        > {
  _$AccountExchangeAccountsControllerDelete200Response? _$v;

  AdminSettingsControllerReloadSettings200ResponseDataBuilder? _data;
  AdminSettingsControllerReloadSettings200ResponseDataBuilder get data =>
      _$this._data ??=
          AdminSettingsControllerReloadSettings200ResponseDataBuilder();
  set data(AdminSettingsControllerReloadSettings200ResponseDataBuilder? data) =>
      _$this._data = data;

  AccountExchangeAccountsControllerDelete200ResponseBuilder() {
    AccountExchangeAccountsControllerDelete200Response._defaults(this);
  }

  AccountExchangeAccountsControllerDelete200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AccountExchangeAccountsControllerDelete200Response other) {
    _$v = other as _$AccountExchangeAccountsControllerDelete200Response;
  }

  @override
  void update(
    void Function(AccountExchangeAccountsControllerDelete200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AccountExchangeAccountsControllerDelete200Response build() => _build();

  _$AccountExchangeAccountsControllerDelete200Response _build() {
    _$AccountExchangeAccountsControllerDelete200Response _$result;
    try {
      _$result =
          _$v ??
          _$AccountExchangeAccountsControllerDelete200Response._(
            data: _data?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'data';
        _data?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AccountExchangeAccountsControllerDelete200Response',
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
