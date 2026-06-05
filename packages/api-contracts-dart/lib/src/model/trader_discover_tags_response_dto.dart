//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/whale_discover_trader_ai_tag_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'trader_discover_tags_response_dto.g.dart';

/// TraderDiscoverTagsResponseDto
///
/// Properties:
/// * [tag] - Discover 视角下的鲸鱼标签文案，例如 $10M+ HYPERUNIT WHALE
/// * [aiTags] - Discover 视角下的 AI 标签列表
@BuiltValue()
abstract class TraderDiscoverTagsResponseDto implements Built<TraderDiscoverTagsResponseDto, TraderDiscoverTagsResponseDtoBuilder> {
  /// Discover 视角下的鲸鱼标签文案，例如 $10M+ HYPERUNIT WHALE
  @BuiltValueField(wireName: r'tag')
  String? get tag;

  /// Discover 视角下的 AI 标签列表
  @BuiltValueField(wireName: r'aiTags')
  BuiltList<WhaleDiscoverTraderAiTagDto> get aiTags;

  TraderDiscoverTagsResponseDto._();

  factory TraderDiscoverTagsResponseDto([void updates(TraderDiscoverTagsResponseDtoBuilder b)]) = _$TraderDiscoverTagsResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(TraderDiscoverTagsResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<TraderDiscoverTagsResponseDto> get serializer => _$TraderDiscoverTagsResponseDtoSerializer();
}

class _$TraderDiscoverTagsResponseDtoSerializer implements PrimitiveSerializer<TraderDiscoverTagsResponseDto> {
  @override
  final Iterable<Type> types = const [TraderDiscoverTagsResponseDto, _$TraderDiscoverTagsResponseDto];

  @override
  final String wireName = r'TraderDiscoverTagsResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    TraderDiscoverTagsResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.tag != null) {
      yield r'tag';
      yield serializers.serialize(
        object.tag,
        specifiedType: const FullType.nullable(String),
      );
    }
    yield r'aiTags';
    yield serializers.serialize(
      object.aiTags,
      specifiedType: const FullType(BuiltList, [FullType(WhaleDiscoverTraderAiTagDto)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    TraderDiscoverTagsResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required TraderDiscoverTagsResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'tag':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.tag = valueDes;
          break;
        case r'aiTags':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(WhaleDiscoverTraderAiTagDto)]),
          ) as BuiltList<WhaleDiscoverTraderAiTagDto>;
          result.aiTags.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  TraderDiscoverTagsResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = TraderDiscoverTagsResponseDtoBuilder();
    final serializedList = (serialized as Iterable<Object?>).toList();
    final unhandled = <Object?>[];
    _deserializeProperties(
      serializers,
      serialized,
      specifiedType: specifiedType,
      serializedList: serializedList,
      unhandled: unhandled,
      result: result,
    );
    return result.build();
  }
}

