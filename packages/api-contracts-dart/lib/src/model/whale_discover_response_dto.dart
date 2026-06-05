//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/whale_discover_trader_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'whale_discover_response_dto.g.dart';

/// WhaleDiscoverResponseDto
///
/// Properties:
/// * [recommended] - 推荐鲸鱼列表，用于页面顶部推荐卡片
/// * [details] - 鲸鱼详情列表，用于下方网格展示
@BuiltValue()
abstract class WhaleDiscoverResponseDto implements Built<WhaleDiscoverResponseDto, WhaleDiscoverResponseDtoBuilder> {
  /// 推荐鲸鱼列表，用于页面顶部推荐卡片
  @BuiltValueField(wireName: r'recommended')
  BuiltList<WhaleDiscoverTraderDto> get recommended;

  /// 鲸鱼详情列表，用于下方网格展示
  @BuiltValueField(wireName: r'details')
  BuiltList<WhaleDiscoverTraderDto> get details;

  WhaleDiscoverResponseDto._();

  factory WhaleDiscoverResponseDto([void updates(WhaleDiscoverResponseDtoBuilder b)]) = _$WhaleDiscoverResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(WhaleDiscoverResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<WhaleDiscoverResponseDto> get serializer => _$WhaleDiscoverResponseDtoSerializer();
}

class _$WhaleDiscoverResponseDtoSerializer implements PrimitiveSerializer<WhaleDiscoverResponseDto> {
  @override
  final Iterable<Type> types = const [WhaleDiscoverResponseDto, _$WhaleDiscoverResponseDto];

  @override
  final String wireName = r'WhaleDiscoverResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    WhaleDiscoverResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'recommended';
    yield serializers.serialize(
      object.recommended,
      specifiedType: const FullType(BuiltList, [FullType(WhaleDiscoverTraderDto)]),
    );
    yield r'details';
    yield serializers.serialize(
      object.details,
      specifiedType: const FullType(BuiltList, [FullType(WhaleDiscoverTraderDto)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    WhaleDiscoverResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required WhaleDiscoverResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'recommended':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(WhaleDiscoverTraderDto)]),
          ) as BuiltList<WhaleDiscoverTraderDto>;
          result.recommended.replace(valueDes);
          break;
        case r'details':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(WhaleDiscoverTraderDto)]),
          ) as BuiltList<WhaleDiscoverTraderDto>;
          result.details.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  WhaleDiscoverResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = WhaleDiscoverResponseDtoBuilder();
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

