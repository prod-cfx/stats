//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'create_exchange_config_dto.g.dart';

/// CreateExchangeConfigDto
///
/// Properties:
/// * [code] - 交易所唯一标识（建议与其他表中的 venue 对齐，通常全大写）
/// * [name] - 交易所展示名称
/// * [avatarUrl] - 头像/Logo URL（建议使用对象存储 URL）
/// * [intro] - 简介
/// * [websiteUrl] - 官网链接
/// * [venueType] - 交易场所类型
/// * [enabled] - 是否启用
/// * [sort] - 排序（数字越小越靠前）
/// * [metadata] - 扩展信息（JSON）
@BuiltValue()
abstract class CreateExchangeConfigDto implements Built<CreateExchangeConfigDto, CreateExchangeConfigDtoBuilder> {
  /// 交易所唯一标识（建议与其他表中的 venue 对齐，通常全大写）
  @BuiltValueField(wireName: r'code')
  String get code;

  /// 交易所展示名称
  @BuiltValueField(wireName: r'name')
  String get name;

  /// 头像/Logo URL（建议使用对象存储 URL）
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
  CreateExchangeConfigDtoVenueTypeEnum? get venueType;
  // enum venueTypeEnum {  CEX,  DEX,  };

  /// 是否启用
  @BuiltValueField(wireName: r'enabled')
  bool? get enabled;

  /// 排序（数字越小越靠前）
  @BuiltValueField(wireName: r'sort')
  num? get sort;

  /// 扩展信息（JSON）
  @BuiltValueField(wireName: r'metadata')
  JsonObject? get metadata;

  CreateExchangeConfigDto._();

  factory CreateExchangeConfigDto([void updates(CreateExchangeConfigDtoBuilder b)]) = _$CreateExchangeConfigDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CreateExchangeConfigDtoBuilder b) => b
      ..enabled = true
      ..sort = 100;

  @BuiltValueSerializer(custom: true)
  static Serializer<CreateExchangeConfigDto> get serializer => _$CreateExchangeConfigDtoSerializer();
}

class _$CreateExchangeConfigDtoSerializer implements PrimitiveSerializer<CreateExchangeConfigDto> {
  @override
  final Iterable<Type> types = const [CreateExchangeConfigDto, _$CreateExchangeConfigDto];

  @override
  final String wireName = r'CreateExchangeConfigDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CreateExchangeConfigDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
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
        specifiedType: const FullType.nullable(CreateExchangeConfigDtoVenueTypeEnum),
      );
    }
    if (object.enabled != null) {
      yield r'enabled';
      yield serializers.serialize(
        object.enabled,
        specifiedType: const FullType(bool),
      );
    }
    if (object.sort != null) {
      yield r'sort';
      yield serializers.serialize(
        object.sort,
        specifiedType: const FullType(num),
      );
    }
    if (object.metadata != null) {
      yield r'metadata';
      yield serializers.serialize(
        object.metadata,
        specifiedType: const FullType.nullable(JsonObject),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    CreateExchangeConfigDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CreateExchangeConfigDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
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
            specifiedType: const FullType.nullable(CreateExchangeConfigDtoVenueTypeEnum),
          ) as CreateExchangeConfigDtoVenueTypeEnum?;
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
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  CreateExchangeConfigDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CreateExchangeConfigDtoBuilder();
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

class CreateExchangeConfigDtoVenueTypeEnum extends EnumClass {

  /// 交易场所类型
  @BuiltValueEnumConst(wireName: r'CEX')
  static const CreateExchangeConfigDtoVenueTypeEnum CEX = _$createExchangeConfigDtoVenueTypeEnum_CEX;
  /// 交易场所类型
  @BuiltValueEnumConst(wireName: r'DEX')
  static const CreateExchangeConfigDtoVenueTypeEnum DEX = _$createExchangeConfigDtoVenueTypeEnum_DEX;

  static Serializer<CreateExchangeConfigDtoVenueTypeEnum> get serializer => _$createExchangeConfigDtoVenueTypeEnumSerializer;

  const CreateExchangeConfigDtoVenueTypeEnum._(String name): super(name);

  static BuiltSet<CreateExchangeConfigDtoVenueTypeEnum> get values => _$createExchangeConfigDtoVenueTypeEnumValues;
  static CreateExchangeConfigDtoVenueTypeEnum valueOf(String name) => _$createExchangeConfigDtoVenueTypeEnumValueOf(name);
}

