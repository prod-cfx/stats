// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'telegram_bot_webhook_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$TelegramBotWebhookRequestDto extends TelegramBotWebhookRequestDto {
  @override
  final num? updateId;
  @override
  final BuiltMap<String, JsonObject?>? message;
  @override
  final BuiltMap<String, JsonObject?>? editedMessage;
  @override
  final BuiltMap<String, JsonObject?>? channelPost;
  @override
  final BuiltMap<String, JsonObject?>? editedChannelPost;
  @override
  final BuiltMap<String, JsonObject?>? callbackQuery;
  @override
  final BuiltMap<String, JsonObject?>? inlineQuery;
  @override
  final BuiltMap<String, JsonObject?>? chosenInlineResult;
  @override
  final BuiltMap<String, JsonObject?>? shippingQuery;
  @override
  final BuiltMap<String, JsonObject?>? preCheckoutQuery;
  @override
  final BuiltMap<String, JsonObject?>? poll;
  @override
  final BuiltMap<String, JsonObject?>? pollAnswer;
  @override
  final BuiltMap<String, JsonObject?>? myChatMember;
  @override
  final BuiltMap<String, JsonObject?>? chatMember;
  @override
  final BuiltMap<String, JsonObject?>? chatJoinRequest;

  factory _$TelegramBotWebhookRequestDto([
    void Function(TelegramBotWebhookRequestDtoBuilder)? updates,
  ]) => (TelegramBotWebhookRequestDtoBuilder()..update(updates))._build();

  _$TelegramBotWebhookRequestDto._({
    this.updateId,
    this.message,
    this.editedMessage,
    this.channelPost,
    this.editedChannelPost,
    this.callbackQuery,
    this.inlineQuery,
    this.chosenInlineResult,
    this.shippingQuery,
    this.preCheckoutQuery,
    this.poll,
    this.pollAnswer,
    this.myChatMember,
    this.chatMember,
    this.chatJoinRequest,
  }) : super._();
  @override
  TelegramBotWebhookRequestDto rebuild(
    void Function(TelegramBotWebhookRequestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  TelegramBotWebhookRequestDtoBuilder toBuilder() =>
      TelegramBotWebhookRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is TelegramBotWebhookRequestDto &&
        updateId == other.updateId &&
        message == other.message &&
        editedMessage == other.editedMessage &&
        channelPost == other.channelPost &&
        editedChannelPost == other.editedChannelPost &&
        callbackQuery == other.callbackQuery &&
        inlineQuery == other.inlineQuery &&
        chosenInlineResult == other.chosenInlineResult &&
        shippingQuery == other.shippingQuery &&
        preCheckoutQuery == other.preCheckoutQuery &&
        poll == other.poll &&
        pollAnswer == other.pollAnswer &&
        myChatMember == other.myChatMember &&
        chatMember == other.chatMember &&
        chatJoinRequest == other.chatJoinRequest;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, updateId.hashCode);
    _$hash = $jc(_$hash, message.hashCode);
    _$hash = $jc(_$hash, editedMessage.hashCode);
    _$hash = $jc(_$hash, channelPost.hashCode);
    _$hash = $jc(_$hash, editedChannelPost.hashCode);
    _$hash = $jc(_$hash, callbackQuery.hashCode);
    _$hash = $jc(_$hash, inlineQuery.hashCode);
    _$hash = $jc(_$hash, chosenInlineResult.hashCode);
    _$hash = $jc(_$hash, shippingQuery.hashCode);
    _$hash = $jc(_$hash, preCheckoutQuery.hashCode);
    _$hash = $jc(_$hash, poll.hashCode);
    _$hash = $jc(_$hash, pollAnswer.hashCode);
    _$hash = $jc(_$hash, myChatMember.hashCode);
    _$hash = $jc(_$hash, chatMember.hashCode);
    _$hash = $jc(_$hash, chatJoinRequest.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'TelegramBotWebhookRequestDto')
          ..add('updateId', updateId)
          ..add('message', message)
          ..add('editedMessage', editedMessage)
          ..add('channelPost', channelPost)
          ..add('editedChannelPost', editedChannelPost)
          ..add('callbackQuery', callbackQuery)
          ..add('inlineQuery', inlineQuery)
          ..add('chosenInlineResult', chosenInlineResult)
          ..add('shippingQuery', shippingQuery)
          ..add('preCheckoutQuery', preCheckoutQuery)
          ..add('poll', poll)
          ..add('pollAnswer', pollAnswer)
          ..add('myChatMember', myChatMember)
          ..add('chatMember', chatMember)
          ..add('chatJoinRequest', chatJoinRequest))
        .toString();
  }
}

class TelegramBotWebhookRequestDtoBuilder
    implements
        Builder<
          TelegramBotWebhookRequestDto,
          TelegramBotWebhookRequestDtoBuilder
        > {
  _$TelegramBotWebhookRequestDto? _$v;

  num? _updateId;
  num? get updateId => _$this._updateId;
  set updateId(num? updateId) => _$this._updateId = updateId;

  MapBuilder<String, JsonObject?>? _message;
  MapBuilder<String, JsonObject?> get message =>
      _$this._message ??= MapBuilder<String, JsonObject?>();
  set message(MapBuilder<String, JsonObject?>? message) =>
      _$this._message = message;

  MapBuilder<String, JsonObject?>? _editedMessage;
  MapBuilder<String, JsonObject?> get editedMessage =>
      _$this._editedMessage ??= MapBuilder<String, JsonObject?>();
  set editedMessage(MapBuilder<String, JsonObject?>? editedMessage) =>
      _$this._editedMessage = editedMessage;

  MapBuilder<String, JsonObject?>? _channelPost;
  MapBuilder<String, JsonObject?> get channelPost =>
      _$this._channelPost ??= MapBuilder<String, JsonObject?>();
  set channelPost(MapBuilder<String, JsonObject?>? channelPost) =>
      _$this._channelPost = channelPost;

  MapBuilder<String, JsonObject?>? _editedChannelPost;
  MapBuilder<String, JsonObject?> get editedChannelPost =>
      _$this._editedChannelPost ??= MapBuilder<String, JsonObject?>();
  set editedChannelPost(MapBuilder<String, JsonObject?>? editedChannelPost) =>
      _$this._editedChannelPost = editedChannelPost;

  MapBuilder<String, JsonObject?>? _callbackQuery;
  MapBuilder<String, JsonObject?> get callbackQuery =>
      _$this._callbackQuery ??= MapBuilder<String, JsonObject?>();
  set callbackQuery(MapBuilder<String, JsonObject?>? callbackQuery) =>
      _$this._callbackQuery = callbackQuery;

  MapBuilder<String, JsonObject?>? _inlineQuery;
  MapBuilder<String, JsonObject?> get inlineQuery =>
      _$this._inlineQuery ??= MapBuilder<String, JsonObject?>();
  set inlineQuery(MapBuilder<String, JsonObject?>? inlineQuery) =>
      _$this._inlineQuery = inlineQuery;

  MapBuilder<String, JsonObject?>? _chosenInlineResult;
  MapBuilder<String, JsonObject?> get chosenInlineResult =>
      _$this._chosenInlineResult ??= MapBuilder<String, JsonObject?>();
  set chosenInlineResult(MapBuilder<String, JsonObject?>? chosenInlineResult) =>
      _$this._chosenInlineResult = chosenInlineResult;

  MapBuilder<String, JsonObject?>? _shippingQuery;
  MapBuilder<String, JsonObject?> get shippingQuery =>
      _$this._shippingQuery ??= MapBuilder<String, JsonObject?>();
  set shippingQuery(MapBuilder<String, JsonObject?>? shippingQuery) =>
      _$this._shippingQuery = shippingQuery;

  MapBuilder<String, JsonObject?>? _preCheckoutQuery;
  MapBuilder<String, JsonObject?> get preCheckoutQuery =>
      _$this._preCheckoutQuery ??= MapBuilder<String, JsonObject?>();
  set preCheckoutQuery(MapBuilder<String, JsonObject?>? preCheckoutQuery) =>
      _$this._preCheckoutQuery = preCheckoutQuery;

  MapBuilder<String, JsonObject?>? _poll;
  MapBuilder<String, JsonObject?> get poll =>
      _$this._poll ??= MapBuilder<String, JsonObject?>();
  set poll(MapBuilder<String, JsonObject?>? poll) => _$this._poll = poll;

  MapBuilder<String, JsonObject?>? _pollAnswer;
  MapBuilder<String, JsonObject?> get pollAnswer =>
      _$this._pollAnswer ??= MapBuilder<String, JsonObject?>();
  set pollAnswer(MapBuilder<String, JsonObject?>? pollAnswer) =>
      _$this._pollAnswer = pollAnswer;

  MapBuilder<String, JsonObject?>? _myChatMember;
  MapBuilder<String, JsonObject?> get myChatMember =>
      _$this._myChatMember ??= MapBuilder<String, JsonObject?>();
  set myChatMember(MapBuilder<String, JsonObject?>? myChatMember) =>
      _$this._myChatMember = myChatMember;

  MapBuilder<String, JsonObject?>? _chatMember;
  MapBuilder<String, JsonObject?> get chatMember =>
      _$this._chatMember ??= MapBuilder<String, JsonObject?>();
  set chatMember(MapBuilder<String, JsonObject?>? chatMember) =>
      _$this._chatMember = chatMember;

  MapBuilder<String, JsonObject?>? _chatJoinRequest;
  MapBuilder<String, JsonObject?> get chatJoinRequest =>
      _$this._chatJoinRequest ??= MapBuilder<String, JsonObject?>();
  set chatJoinRequest(MapBuilder<String, JsonObject?>? chatJoinRequest) =>
      _$this._chatJoinRequest = chatJoinRequest;

  TelegramBotWebhookRequestDtoBuilder() {
    TelegramBotWebhookRequestDto._defaults(this);
  }

  TelegramBotWebhookRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _updateId = $v.updateId;
      _message = $v.message?.toBuilder();
      _editedMessage = $v.editedMessage?.toBuilder();
      _channelPost = $v.channelPost?.toBuilder();
      _editedChannelPost = $v.editedChannelPost?.toBuilder();
      _callbackQuery = $v.callbackQuery?.toBuilder();
      _inlineQuery = $v.inlineQuery?.toBuilder();
      _chosenInlineResult = $v.chosenInlineResult?.toBuilder();
      _shippingQuery = $v.shippingQuery?.toBuilder();
      _preCheckoutQuery = $v.preCheckoutQuery?.toBuilder();
      _poll = $v.poll?.toBuilder();
      _pollAnswer = $v.pollAnswer?.toBuilder();
      _myChatMember = $v.myChatMember?.toBuilder();
      _chatMember = $v.chatMember?.toBuilder();
      _chatJoinRequest = $v.chatJoinRequest?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(TelegramBotWebhookRequestDto other) {
    _$v = other as _$TelegramBotWebhookRequestDto;
  }

  @override
  void update(void Function(TelegramBotWebhookRequestDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  TelegramBotWebhookRequestDto build() => _build();

  _$TelegramBotWebhookRequestDto _build() {
    _$TelegramBotWebhookRequestDto _$result;
    try {
      _$result =
          _$v ??
          _$TelegramBotWebhookRequestDto._(
            updateId: updateId,
            message: _message?.build(),
            editedMessage: _editedMessage?.build(),
            channelPost: _channelPost?.build(),
            editedChannelPost: _editedChannelPost?.build(),
            callbackQuery: _callbackQuery?.build(),
            inlineQuery: _inlineQuery?.build(),
            chosenInlineResult: _chosenInlineResult?.build(),
            shippingQuery: _shippingQuery?.build(),
            preCheckoutQuery: _preCheckoutQuery?.build(),
            poll: _poll?.build(),
            pollAnswer: _pollAnswer?.build(),
            myChatMember: _myChatMember?.build(),
            chatMember: _chatMember?.build(),
            chatJoinRequest: _chatJoinRequest?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'message';
        _message?.build();
        _$failedField = 'editedMessage';
        _editedMessage?.build();
        _$failedField = 'channelPost';
        _channelPost?.build();
        _$failedField = 'editedChannelPost';
        _editedChannelPost?.build();
        _$failedField = 'callbackQuery';
        _callbackQuery?.build();
        _$failedField = 'inlineQuery';
        _inlineQuery?.build();
        _$failedField = 'chosenInlineResult';
        _chosenInlineResult?.build();
        _$failedField = 'shippingQuery';
        _shippingQuery?.build();
        _$failedField = 'preCheckoutQuery';
        _preCheckoutQuery?.build();
        _$failedField = 'poll';
        _poll?.build();
        _$failedField = 'pollAnswer';
        _pollAnswer?.build();
        _$failedField = 'myChatMember';
        _myChatMember?.build();
        _$failedField = 'chatMember';
        _chatMember?.build();
        _$failedField = 'chatJoinRequest';
        _chatJoinRequest?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'TelegramBotWebhookRequestDto',
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
