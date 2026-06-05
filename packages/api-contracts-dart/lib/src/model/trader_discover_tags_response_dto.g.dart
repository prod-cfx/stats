// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'trader_discover_tags_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$TraderDiscoverTagsResponseDto extends TraderDiscoverTagsResponseDto {
  @override
  final String? tag;
  @override
  final BuiltList<WhaleDiscoverTraderAiTagDto> aiTags;

  factory _$TraderDiscoverTagsResponseDto([
    void Function(TraderDiscoverTagsResponseDtoBuilder)? updates,
  ]) => (TraderDiscoverTagsResponseDtoBuilder()..update(updates))._build();

  _$TraderDiscoverTagsResponseDto._({this.tag, required this.aiTags})
    : super._();
  @override
  TraderDiscoverTagsResponseDto rebuild(
    void Function(TraderDiscoverTagsResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  TraderDiscoverTagsResponseDtoBuilder toBuilder() =>
      TraderDiscoverTagsResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is TraderDiscoverTagsResponseDto &&
        tag == other.tag &&
        aiTags == other.aiTags;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, tag.hashCode);
    _$hash = $jc(_$hash, aiTags.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'TraderDiscoverTagsResponseDto')
          ..add('tag', tag)
          ..add('aiTags', aiTags))
        .toString();
  }
}

class TraderDiscoverTagsResponseDtoBuilder
    implements
        Builder<
          TraderDiscoverTagsResponseDto,
          TraderDiscoverTagsResponseDtoBuilder
        > {
  _$TraderDiscoverTagsResponseDto? _$v;

  String? _tag;
  String? get tag => _$this._tag;
  set tag(String? tag) => _$this._tag = tag;

  ListBuilder<WhaleDiscoverTraderAiTagDto>? _aiTags;
  ListBuilder<WhaleDiscoverTraderAiTagDto> get aiTags =>
      _$this._aiTags ??= ListBuilder<WhaleDiscoverTraderAiTagDto>();
  set aiTags(ListBuilder<WhaleDiscoverTraderAiTagDto>? aiTags) =>
      _$this._aiTags = aiTags;

  TraderDiscoverTagsResponseDtoBuilder() {
    TraderDiscoverTagsResponseDto._defaults(this);
  }

  TraderDiscoverTagsResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _tag = $v.tag;
      _aiTags = $v.aiTags.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(TraderDiscoverTagsResponseDto other) {
    _$v = other as _$TraderDiscoverTagsResponseDto;
  }

  @override
  void update(void Function(TraderDiscoverTagsResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  TraderDiscoverTagsResponseDto build() => _build();

  _$TraderDiscoverTagsResponseDto _build() {
    _$TraderDiscoverTagsResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$TraderDiscoverTagsResponseDto._(tag: tag, aiTags: aiTags.build());
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'aiTags';
        aiTags.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'TraderDiscoverTagsResponseDto',
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
