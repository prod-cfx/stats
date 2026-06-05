// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'whale_notification_inbox_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$WhaleNotificationInboxResponseDto
    extends WhaleNotificationInboxResponseDto {
  @override
  final String id;
  @override
  final String title;
  @override
  final String content;
  @override
  final String? ruleId;
  @override
  final WhaleNotificationDeliveryMapDto channels;
  @override
  final bool read;
  @override
  final String createdAt;

  factory _$WhaleNotificationInboxResponseDto([
    void Function(WhaleNotificationInboxResponseDtoBuilder)? updates,
  ]) => (WhaleNotificationInboxResponseDtoBuilder()..update(updates))._build();

  _$WhaleNotificationInboxResponseDto._({
    required this.id,
    required this.title,
    required this.content,
    this.ruleId,
    required this.channels,
    required this.read,
    required this.createdAt,
  }) : super._();
  @override
  WhaleNotificationInboxResponseDto rebuild(
    void Function(WhaleNotificationInboxResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  WhaleNotificationInboxResponseDtoBuilder toBuilder() =>
      WhaleNotificationInboxResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is WhaleNotificationInboxResponseDto &&
        id == other.id &&
        title == other.title &&
        content == other.content &&
        ruleId == other.ruleId &&
        channels == other.channels &&
        read == other.read &&
        createdAt == other.createdAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, title.hashCode);
    _$hash = $jc(_$hash, content.hashCode);
    _$hash = $jc(_$hash, ruleId.hashCode);
    _$hash = $jc(_$hash, channels.hashCode);
    _$hash = $jc(_$hash, read.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'WhaleNotificationInboxResponseDto')
          ..add('id', id)
          ..add('title', title)
          ..add('content', content)
          ..add('ruleId', ruleId)
          ..add('channels', channels)
          ..add('read', read)
          ..add('createdAt', createdAt))
        .toString();
  }
}

class WhaleNotificationInboxResponseDtoBuilder
    implements
        Builder<
          WhaleNotificationInboxResponseDto,
          WhaleNotificationInboxResponseDtoBuilder
        > {
  _$WhaleNotificationInboxResponseDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _title;
  String? get title => _$this._title;
  set title(String? title) => _$this._title = title;

  String? _content;
  String? get content => _$this._content;
  set content(String? content) => _$this._content = content;

  String? _ruleId;
  String? get ruleId => _$this._ruleId;
  set ruleId(String? ruleId) => _$this._ruleId = ruleId;

  WhaleNotificationDeliveryMapDtoBuilder? _channels;
  WhaleNotificationDeliveryMapDtoBuilder get channels =>
      _$this._channels ??= WhaleNotificationDeliveryMapDtoBuilder();
  set channels(WhaleNotificationDeliveryMapDtoBuilder? channels) =>
      _$this._channels = channels;

  bool? _read;
  bool? get read => _$this._read;
  set read(bool? read) => _$this._read = read;

  String? _createdAt;
  String? get createdAt => _$this._createdAt;
  set createdAt(String? createdAt) => _$this._createdAt = createdAt;

  WhaleNotificationInboxResponseDtoBuilder() {
    WhaleNotificationInboxResponseDto._defaults(this);
  }

  WhaleNotificationInboxResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _title = $v.title;
      _content = $v.content;
      _ruleId = $v.ruleId;
      _channels = $v.channels.toBuilder();
      _read = $v.read;
      _createdAt = $v.createdAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(WhaleNotificationInboxResponseDto other) {
    _$v = other as _$WhaleNotificationInboxResponseDto;
  }

  @override
  void update(
    void Function(WhaleNotificationInboxResponseDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  WhaleNotificationInboxResponseDto build() => _build();

  _$WhaleNotificationInboxResponseDto _build() {
    _$WhaleNotificationInboxResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$WhaleNotificationInboxResponseDto._(
            id: BuiltValueNullFieldError.checkNotNull(
              id,
              r'WhaleNotificationInboxResponseDto',
              'id',
            ),
            title: BuiltValueNullFieldError.checkNotNull(
              title,
              r'WhaleNotificationInboxResponseDto',
              'title',
            ),
            content: BuiltValueNullFieldError.checkNotNull(
              content,
              r'WhaleNotificationInboxResponseDto',
              'content',
            ),
            ruleId: ruleId,
            channels: channels.build(),
            read: BuiltValueNullFieldError.checkNotNull(
              read,
              r'WhaleNotificationInboxResponseDto',
              'read',
            ),
            createdAt: BuiltValueNullFieldError.checkNotNull(
              createdAt,
              r'WhaleNotificationInboxResponseDto',
              'createdAt',
            ),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'channels';
        channels.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'WhaleNotificationInboxResponseDto',
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
