//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'exchange_config_response_dto.g.dart';

/// ExchangeConfigResponseDto
///
/// Properties:
/// * [id] - 配置ID
/// * [code] - 交易所唯一标识（建议与 venue 对齐）
/// * [name] - 交易所展示名称
/// * [avatarUrl] - 头像/Logo URL
/// * [intro] - 简介
/// * [websiteUrl] - 官网链接
/// * [venueType] - 交易场所类型
/// * [enabled] - 是否启用
/// * [sort] - 排序（数字越小越靠前）
/// * [metadata] - 扩展信息（JSON）
/// * [createdAt] - 创建时间
/// * [updatedAt] - 更新时间
@BuiltValue()
abstract class ExchangeConfigResponseDto implements Built<ExchangeConfigResponseDto, ExchangeConfigResponseDtoBuilder> {
  /// 配置ID
  @BuiltValueField(wireName: r'id')
  String get id;

  /// 交易所唯一标识（建议与 venue 对齐）
  @BuiltValueField(wireName: r'code')
  String get code;

  /// 交易所展示名称
  @BuiltValueField(wireName: r'name')
  String get name;

  /// 头像/Logo URL
  @BuiltValueField(wireName: r'avatarUrl')
  String? get avatarUrl;

  /// 简介
  @BuiltValueField(wireName: r'intro')
  String? get intro;

  /// 官网链接
  @BuiltValueField(wireName: r'websiteUrl')
  String? get websiteUrl;

  /// 交易场所类型
  @BuiltValueField(wireName: r'venueType')
  ExchangeConfigResponseDtoVenueTypeEnum? get venueType;
  // enum venueTypeEnum {  CEX,  DEX,  };

  /// 是否启用
  @BuiltValueField(wireName: r'enabled')
  bool get enabled;

  /// 排序（数字越小越靠前）
  @BuiltValueField(wireName: r'sort')
  num get sort;

  /// 扩展信息（JSON）
  @BuiltValueField(wireName: r'metadata')
  JsonObject? get metadata;

  /// 创建时间
  @BuiltValueField(wireName: r'createdAt')
  DateTime get createdAt;

  /// 更新时间
  @BuiltValueField(wireName: r'updatedAt')
  DateTime get updatedAt;

  ExchangeConfigResponseDto._();

  factory ExchangeConfigResponseDto([void updates(ExchangeConfigResponseDtoBuilder b)]) = _$ExchangeConfigResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(ExchangeConfigResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<ExchangeConfigResponseDto> get serializer => _$ExchangeConfigResponseDtoSerializer();
}

class _$ExchangeConfigResponseDtoSerializer implements PrimitiveSerializer<ExchangeConfigResponseDto> {
  @override
  final Iterable<Type> types = const [ExchangeConfigResponseDto, _$ExchangeConfigResponseDto];

  @override
  final String wireName = r'ExchangeConfigResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    ExchangeConfigResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'code';
    yield serializers.serialize(
      object.code,
      specifiedType: const FullType(String),
    );
    yield r'name';
    yield serializers.serialize(
      object.name,
      specifiedType: const FullType(String),
    );
    if (object.avatarUrl != null) {
      yield r'avatarUrl';
      yield serializers.serialize(
        object.avatarUrl,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.intro != null) {
      yield r'intro';
      yield serializers.serialize(
        object.intro,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.websiteUrl != null) {
      yield r'websiteUrl';
      yield serializers.serialize(
        object.websiteUrl,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.venueType != null) {
      yield r'venueType';
      yield serializers.serialize(
        object.venueType,
        specifiedType: const FullType.nullable(ExchangeConfigResponseDtoVenueTypeEnum),
      );
    }
    yield r'enabled';
    yield serializers.serialize(
      object.enabled,
      specifiedType: const FullType(bool),
    );
    yield r'sort';
    yield serializers.serialize(
      object.sort,
      specifiedType: const FullType(num),
    );
    if (object.metadata != null) {
      yield r'metadata';
      yield serializers.serialize(
        object.metadata,
        specifiedType: const FullType.nullable(JsonObject),
      );
    }
    yield r'createdAt';
    yield serializers.serialize(
      object.createdAt,
      specifiedType: const FullType(DateTime),
    );
    yield r'updatedAt';
    yield serializers.serialize(
      object.updatedAt,
      specifiedType: const FullType(DateTime),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    ExchangeConfigResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required ExchangeConfigResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.id = valueDes;
          break;
        case r'code':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.code = valueDes;
          break;
        case r'name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.name = valueDes;
          break;
        case r'avatarUrl':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.avatarUrl = valueDes;
          break;
        case r'intro':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.intro = valueDes;
          break;
        case r'websiteUrl':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.websiteUrl = valueDes;
          break;
        case r'venueType':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(ExchangeConfigResponseDtoVenueTypeEnum),
          ) as ExchangeConfigResponseDtoVenueTypeEnum?;
          if (valueDes == null) continue;
          result.venueType = valueDes;
          break;
        case r'enabled':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.enabled = valueDes;
          break;
        case r'sort':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.sort = valueDes;
          break;
        case r'metadata':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(JsonObject),
          ) as JsonObject?;
          if (valueDes == null) continue;
          result.metadata = valueDes;
          break;
        case r'createdAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.createdAt = valueDes;
          break;
        case r'updatedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.updatedAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  ExchangeConfigResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = ExchangeConfigResponseDtoBuilder();
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

class ExchangeConfigResponseDtoVenueTypeEnum extends EnumClass {

  /// 交易场所类型
  @BuiltValueEnumConst(wireName: r'CEX')
  static const ExchangeConfigResponseDtoVenueTypeEnum CEX = _$exchangeConfigResponseDtoVenueTypeEnum_CEX;
  /// 交易场所类型
  @BuiltValueEnumConst(wireName: r'DEX')
  static const ExchangeConfigResponseDtoVenueTypeEnum DEX = _$exchangeConfigResponseDtoVenueTypeEnum_DEX;

  static Serializer<ExchangeConfigResponseDtoVenueTypeEnum> get serializer => _$exchangeConfigResponseDtoVenueTypeEnumSerializer;

  const ExchangeConfigResponseDtoVenueTypeEnum._(String name): super(name);

  static BuiltSet<ExchangeConfigResponseDtoVenueTypeEnum> get values => _$exchangeConfigResponseDtoVenueTypeEnumValues;
  static ExchangeConfigResponseDtoVenueTypeEnum valueOf(String name) => _$exchangeConfigResponseDtoVenueTypeEnumValueOf(name);
}

