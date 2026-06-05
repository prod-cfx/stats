// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'whale_notification_inbox_controller_unread_count200_response_data.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$WhaleNotificationInboxControllerUnreadCount200ResponseData
    extends WhaleNotificationInboxControllerUnreadCount200ResponseData {
  @override
  final num? unread;

  factory _$WhaleNotificationInboxControllerUnreadCount200ResponseData([
    void Function(
      WhaleNotificationInboxControllerUnreadCount200ResponseDataBuilder,
    )?
    updates,
  ]) =>
      (WhaleNotificationInboxControllerUnreadCount200ResponseDataBuilder()
            ..update(updates))
          ._build();

  _$WhaleNotificationInboxControllerUnreadCount200ResponseData._({this.unread})
    : super._();
  @override
  WhaleNotificationInboxControllerUnreadCount200ResponseData rebuild(
    void Function(
      WhaleNotificationInboxControllerUnreadCount200ResponseDataBuilder,
    )
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  WhaleNotificationInboxControllerUnreadCount200ResponseDataBuilder
  toBuilder() =>
      WhaleNotificationInboxControllerUnreadCount200ResponseDataBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other
            is WhaleNotificationInboxControllerUnreadCount200ResponseData &&
        unread == other.unread;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, unread.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'WhaleNotificationInboxControllerUnreadCount200ResponseData',
    )..add('unread', unread)).toString();
  }
}

class WhaleNotificationInboxControllerUnreadCount200ResponseDataBuilder
    implements
        Builder<
          WhaleNotificationInboxControllerUnreadCount200ResponseData,
          WhaleNotificationInboxControllerUnreadCount200ResponseDataBuilder
        > {
  _$WhaleNotificationInboxControllerUnreadCount200ResponseData? _$v;

  num? _unread;
  num? get unread => _$this._unread;
  set unread(num? unread) => _$this._unread = unread;

  WhaleNotificationInboxControllerUnreadCount200ResponseDataBuilder() {
    WhaleNotificationInboxControllerUnreadCount200ResponseData._defaults(this);
  }

  WhaleNotificationInboxControllerUnreadCount200ResponseDataBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _unread = $v.unread;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(
    WhaleNotificationInboxControllerUnreadCount200ResponseData other,
  ) {
    _$v = other as _$WhaleNotificationInboxControllerUnreadCount200ResponseData;
  }

  @override
  void update(
    void Function(
      WhaleNotificationInboxControllerUnreadCount200ResponseDataBuilder,
    )?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  WhaleNotificationInboxControllerUnreadCount200ResponseData build() =>
      _build();

  _$WhaleNotificationInboxControllerUnreadCount200ResponseData _build() {
    final _$result =
        _$v ??
        _$WhaleNotificationInboxControllerUnreadCount200ResponseData._(
          unread: unread,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
