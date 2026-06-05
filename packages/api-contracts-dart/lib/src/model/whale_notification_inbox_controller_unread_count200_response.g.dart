// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'whale_notification_inbox_controller_unread_count200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$WhaleNotificationInboxControllerUnreadCount200Response
    extends WhaleNotificationInboxControllerUnreadCount200Response {
  @override
  final WhaleNotificationInboxControllerUnreadCount200ResponseData? data;
  @override
  final String? message;

  factory _$WhaleNotificationInboxControllerUnreadCount200Response([
    void Function(
      WhaleNotificationInboxControllerUnreadCount200ResponseBuilder,
    )?
    updates,
  ]) =>
      (WhaleNotificationInboxControllerUnreadCount200ResponseBuilder()
            ..update(updates))
          ._build();

  _$WhaleNotificationInboxControllerUnreadCount200Response._({
    this.data,
    this.message,
  }) : super._();
  @override
  WhaleNotificationInboxControllerUnreadCount200Response rebuild(
    void Function(WhaleNotificationInboxControllerUnreadCount200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  WhaleNotificationInboxControllerUnreadCount200ResponseBuilder toBuilder() =>
      WhaleNotificationInboxControllerUnreadCount200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is WhaleNotificationInboxControllerUnreadCount200Response &&
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
            r'WhaleNotificationInboxControllerUnreadCount200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class WhaleNotificationInboxControllerUnreadCount200ResponseBuilder
    implements
        Builder<
          WhaleNotificationInboxControllerUnreadCount200Response,
          WhaleNotificationInboxControllerUnreadCount200ResponseBuilder
        > {
  _$WhaleNotificationInboxControllerUnreadCount200Response? _$v;

  WhaleNotificationInboxControllerUnreadCount200ResponseDataBuilder? _data;
  WhaleNotificationInboxControllerUnreadCount200ResponseDataBuilder get data =>
      _$this._data ??=
          WhaleNotificationInboxControllerUnreadCount200ResponseDataBuilder();
  set data(
    WhaleNotificationInboxControllerUnreadCount200ResponseDataBuilder? data,
  ) => _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  WhaleNotificationInboxControllerUnreadCount200ResponseBuilder() {
    WhaleNotificationInboxControllerUnreadCount200Response._defaults(this);
  }

  WhaleNotificationInboxControllerUnreadCount200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data?.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(WhaleNotificationInboxControllerUnreadCount200Response other) {
    _$v = other as _$WhaleNotificationInboxControllerUnreadCount200Response;
  }

  @override
  void update(
    void Function(
      WhaleNotificationInboxControllerUnreadCount200ResponseBuilder,
    )?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  WhaleNotificationInboxControllerUnreadCount200Response build() => _build();

  _$WhaleNotificationInboxControllerUnreadCount200Response _build() {
    _$WhaleNotificationInboxControllerUnreadCount200Response _$result;
    try {
      _$result =
          _$v ??
          _$WhaleNotificationInboxControllerUnreadCount200Response._(
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
          r'WhaleNotificationInboxControllerUnreadCount200Response',
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
