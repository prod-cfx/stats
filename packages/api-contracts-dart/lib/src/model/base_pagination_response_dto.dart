//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'base_pagination_response_dto.g.dart';

/// BasePaginationResponseDto
///
/// Properties:
/// * [total] - 数据总量
/// * [page] - 当前页码
/// * [limit] - 每页数量
/// * [items] - 当前页数据列表
@BuiltValue(instantiable: false)
abstract class BasePaginationResponseDto  {
  /// 数据总量
  @BuiltValueField(wireName: r'total')
  num get total;

  /// 当前页码
  @BuiltValueField(wireName: r'page')
  num get page;

  /// 每页数量
  @BuiltValueField(wireName: r'limit')
  num get limit;

  /// 当前页数据列表
  @BuiltValueField(wireName: r'items')
  BuiltList<JsonObject> get items;

  @BuiltValueSerializer(custom: true)
  static Serializer<BasePaginationResponseDto> get serializer => _$BasePaginationResponseDtoSerializer();
}

class _$BasePaginationResponseDtoSerializer implements PrimitiveSerializer<BasePaginationResponseDto> {
  @override
  final Iterable<Type> types = const [BasePaginationResponseDto];

  @override
  final String wireName = r'BasePaginationResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BasePaginationResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'total';
    yield serializers.serialize(
      object.total,
      specifiedType: const FullType(num),
    );
    yield r'page';
    yield serializers.serialize(
      object.page,
      specifiedType: const FullType(num),
    );
    yield r'limit';
    yield serializers.serialize(
      object.limit,
      specifiedType: const FullType(num),
    );
    yield r'items';
    yield serializers.serialize(
      object.items,
      specifiedType: const FullType(BuiltList, [FullType(JsonObject)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    BasePaginationResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  @override
  BasePaginationResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return serializers.deserialize(serialized, specifiedType: FullType($BasePaginationResponseDto)) as $BasePaginationResponseDto;
  }
}

/// a concrete implementation of [BasePaginationResponseDto], since [BasePaginationResponseDto] is not instantiable
@BuiltValue(instantiable: true)
abstract class $BasePaginationResponseDto implements BasePaginationResponseDto, Built<$BasePaginationResponseDto, $BasePaginationResponseDtoBuilder> {
  $BasePaginationResponseDto._();

  factory $BasePaginationResponseDto([void Function($BasePaginationResponseDtoBuilder)? updates]) = _$$BasePaginationResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults($BasePaginationResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<$BasePaginationResponseDto> get serializer => _$$BasePaginationResponseDtoSerializer();
}

class _$$BasePaginationResponseDtoSerializer implements PrimitiveSerializer<$BasePaginationResponseDto> {
  @override
  final Iterable<Type> types = const [$BasePaginationResponseDto, _$$BasePaginationResponseDto];

  @override
  final String wireName = r'$BasePaginationResponseDto';

  @override
  Object serialize(
    Serializers serializers,
    $BasePaginationResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return serializers.serialize(object, specifiedType: FullType(BasePaginationResponseDto))!;
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BasePaginationResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'total':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.total = valueDes;
          break;
        case r'page':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.page = valueDes;
          break;
        case r'limit':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.limit = valueDes;
          break;
        case r'items':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(JsonObject)]),
          ) as BuiltList<JsonObject>;
          result.items.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  $BasePaginationResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = $BasePaginationResponseDtoBuilder();
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

