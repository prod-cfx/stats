//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'whale_discover_trader_ai_tag_dto.g.dart';

/// WhaleDiscoverTraderAiTagDto
///
/// Properties:
/// * [key] - AI 标签 key，用于前端 i18n 映射
/// * [color] - 文本颜色（十六进制或 CSS 颜色值）
/// * [bgColor] - 背景颜色（十六进制或 CSS 颜色值）
/// * [descriptionKey] - 描述文案对应的 i18n key，可选
@BuiltValue()
abstract class WhaleDiscoverTraderAiTagDto implements Built<WhaleDiscoverTraderAiTagDto, WhaleDiscoverTraderAiTagDtoBuilder> {
  /// AI 标签 key，用于前端 i18n 映射
  @BuiltValueField(wireName: r'key')
  WhaleDiscoverTraderAiTagDtoKeyEnum get key;
  // enum keyEnum {  bullWarGod,  swingKing,  smartTrader,  treasuryKeeper,  twitterKol,  };

  /// 文本颜色（十六进制或 CSS 颜色值）
  @BuiltValueField(wireName: r'color')
  String get color;

  /// 背景颜色（十六进制或 CSS 颜色值）
  @BuiltValueField(wireName: r'bgColor')
  String get bgColor;

  /// 描述文案对应的 i18n key，可选
  @BuiltValueField(wireName: r'descriptionKey')
  WhaleDiscoverTraderAiTagDtoDescriptionKeyEnum? get descriptionKey;
  // enum descriptionKeyEnum {  bullWarGod,  swingKing,  smartTrader,  treasuryKeeper,  twitterKol,  };

  WhaleDiscoverTraderAiTagDto._();

  factory WhaleDiscoverTraderAiTagDto([void updates(WhaleDiscoverTraderAiTagDtoBuilder b)]) = _$WhaleDiscoverTraderAiTagDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(WhaleDiscoverTraderAiTagDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<WhaleDiscoverTraderAiTagDto> get serializer => _$WhaleDiscoverTraderAiTagDtoSerializer();
}

class _$WhaleDiscoverTraderAiTagDtoSerializer implements PrimitiveSerializer<WhaleDiscoverTraderAiTagDto> {
  @override
  final Iterable<Type> types = const [WhaleDiscoverTraderAiTagDto, _$WhaleDiscoverTraderAiTagDto];

  @override
  final String wireName = r'WhaleDiscoverTraderAiTagDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    WhaleDiscoverTraderAiTagDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'key';
    yield serializers.serialize(
      object.key,
      specifiedType: const FullType(WhaleDiscoverTraderAiTagDtoKeyEnum),
    );
    yield r'color';
    yield serializers.serialize(
      object.color,
      specifiedType: const FullType(String),
    );
    yield r'bgColor';
    yield serializers.serialize(
      object.bgColor,
      specifiedType: const FullType(String),
    );
    if (object.descriptionKey != null) {
      yield r'descriptionKey';
      yield serializers.serialize(
        object.descriptionKey,
        specifiedType: const FullType(WhaleDiscoverTraderAiTagDtoDescriptionKeyEnum),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    WhaleDiscoverTraderAiTagDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required WhaleDiscoverTraderAiTagDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'key':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(WhaleDiscoverTraderAiTagDtoKeyEnum),
          ) as WhaleDiscoverTraderAiTagDtoKeyEnum;
          result.key = valueDes;
          break;
        case r'color':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.color = valueDes;
          break;
        case r'bgColor':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.bgColor = valueDes;
          break;
        case r'descriptionKey':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(WhaleDiscoverTraderAiTagDtoDescriptionKeyEnum),
          ) as WhaleDiscoverTraderAiTagDtoDescriptionKeyEnum;
          result.descriptionKey = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  WhaleDiscoverTraderAiTagDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = WhaleDiscoverTraderAiTagDtoBuilder();
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

class WhaleDiscoverTraderAiTagDtoKeyEnum extends EnumClass {

  /// AI 标签 key，用于前端 i18n 映射
  @BuiltValueEnumConst(wireName: r'bullWarGod')
  static const WhaleDiscoverTraderAiTagDtoKeyEnum bullWarGod = _$whaleDiscoverTraderAiTagDtoKeyEnum_bullWarGod;
  /// AI 标签 key，用于前端 i18n 映射
  @BuiltValueEnumConst(wireName: r'swingKing')
  static const WhaleDiscoverTraderAiTagDtoKeyEnum swingKing = _$whaleDiscoverTraderAiTagDtoKeyEnum_swingKing;
  /// AI 标签 key，用于前端 i18n 映射
  @BuiltValueEnumConst(wireName: r'smartTrader')
  static const WhaleDiscoverTraderAiTagDtoKeyEnum smartTrader = _$whaleDiscoverTraderAiTagDtoKeyEnum_smartTrader;
  /// AI 标签 key，用于前端 i18n 映射
  @BuiltValueEnumConst(wireName: r'treasuryKeeper')
  static const WhaleDiscoverTraderAiTagDtoKeyEnum treasuryKeeper = _$whaleDiscoverTraderAiTagDtoKeyEnum_treasuryKeeper;
  /// AI 标签 key，用于前端 i18n 映射
  @BuiltValueEnumConst(wireName: r'twitterKol')
  static const WhaleDiscoverTraderAiTagDtoKeyEnum twitterKol = _$whaleDiscoverTraderAiTagDtoKeyEnum_twitterKol;

  static Serializer<WhaleDiscoverTraderAiTagDtoKeyEnum> get serializer => _$whaleDiscoverTraderAiTagDtoKeyEnumSerializer;

  const WhaleDiscoverTraderAiTagDtoKeyEnum._(String name): super(name);

  static BuiltSet<WhaleDiscoverTraderAiTagDtoKeyEnum> get values => _$whaleDiscoverTraderAiTagDtoKeyEnumValues;
  static WhaleDiscoverTraderAiTagDtoKeyEnum valueOf(String name) => _$whaleDiscoverTraderAiTagDtoKeyEnumValueOf(name);
}

class WhaleDiscoverTraderAiTagDtoDescriptionKeyEnum extends EnumClass {

  /// 描述文案对应的 i18n key，可选
  @BuiltValueEnumConst(wireName: r'bullWarGod')
  static const WhaleDiscoverTraderAiTagDtoDescriptionKeyEnum bullWarGod = _$whaleDiscoverTraderAiTagDtoDescriptionKeyEnum_bullWarGod;
  /// 描述文案对应的 i18n key，可选
  @BuiltValueEnumConst(wireName: r'swingKing')
  static const WhaleDiscoverTraderAiTagDtoDescriptionKeyEnum swingKing = _$whaleDiscoverTraderAiTagDtoDescriptionKeyEnum_swingKing;
  /// 描述文案对应的 i18n key，可选
  @BuiltValueEnumConst(wireName: r'smartTrader')
  static const WhaleDiscoverTraderAiTagDtoDescriptionKeyEnum smartTrader = _$whaleDiscoverTraderAiTagDtoDescriptionKeyEnum_smartTrader;
  /// 描述文案对应的 i18n key，可选
  @BuiltValueEnumConst(wireName: r'treasuryKeeper')
  static const WhaleDiscoverTraderAiTagDtoDescriptionKeyEnum treasuryKeeper = _$whaleDiscoverTraderAiTagDtoDescriptionKeyEnum_treasuryKeeper;
  /// 描述文案对应的 i18n key，可选
  @BuiltValueEnumConst(wireName: r'twitterKol')
  static const WhaleDiscoverTraderAiTagDtoDescriptionKeyEnum twitterKol = _$whaleDiscoverTraderAiTagDtoDescriptionKeyEnum_twitterKol;

  static Serializer<WhaleDiscoverTraderAiTagDtoDescriptionKeyEnum> get serializer => _$whaleDiscoverTraderAiTagDtoDescriptionKeyEnumSerializer;

  const WhaleDiscoverTraderAiTagDtoDescriptionKeyEnum._(String name): super(name);

  static BuiltSet<WhaleDiscoverTraderAiTagDtoDescriptionKeyEnum> get values => _$whaleDiscoverTraderAiTagDtoDescriptionKeyEnumValues;
  static WhaleDiscoverTraderAiTagDtoDescriptionKeyEnum valueOf(String name) => _$whaleDiscoverTraderAiTagDtoDescriptionKeyEnumValueOf(name);
}

