//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'backtesting_symbol_support_response_dto.g.dart';

/// BacktestingSymbolSupportResponseDto
///
/// Properties:
/// * [status] 
/// * [reasonCode] 
/// * [args] 
@BuiltValue()
abstract class BacktestingSymbolSupportResponseDto implements Built<BacktestingSymbolSupportResponseDto, BacktestingSymbolSupportResponseDtoBuilder> {
  @BuiltValueField(wireName: r'status')
  BacktestingSymbolSupportResponseDtoStatusEnum get status;
  // enum statusEnum {  supported,  refreshed_then_supported,  not_supported,  };

  @BuiltValueField(wireName: r'reasonCode')
  String? get reasonCode;

  @BuiltValueField(wireName: r'args')
  BuiltMap<String, JsonObject?>? get args;

  BacktestingSymbolSupportResponseDto._();

  factory BacktestingSymbolSupportResponseDto([void updates(BacktestingSymbolSupportResponseDtoBuilder b)]) = _$BacktestingSymbolSupportResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(BacktestingSymbolSupportResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<BacktestingSymbolSupportResponseDto> get serializer => _$BacktestingSymbolSupportResponseDtoSerializer();
}

class _$BacktestingSymbolSupportResponseDtoSerializer implements PrimitiveSerializer<BacktestingSymbolSupportResponseDto> {
  @override
  final Iterable<Type> types = const [BacktestingSymbolSupportResponseDto, _$BacktestingSymbolSupportResponseDto];

  @override
  final String wireName = r'BacktestingSymbolSupportResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BacktestingSymbolSupportResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'status';
    yield serializers.serialize(
      object.status,
      specifiedType: const FullType(BacktestingSymbolSupportResponseDtoStatusEnum),
    );
    if (object.reasonCode != null) {
      yield r'reasonCode';
      yield serializers.serialize(
        object.reasonCode,
        specifiedType: const FullType(String),
      );
    }
    if (object.args != null) {
      yield r'args';
      yield serializers.serialize(
        object.args,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    BacktestingSymbolSupportResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BacktestingSymbolSupportResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BacktestingSymbolSupportResponseDtoStatusEnum),
          ) as BacktestingSymbolSupportResponseDtoStatusEnum;
          result.status = valueDes;
          break;
        case r'reasonCode':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.reasonCode = valueDes;
          break;
        case r'args':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.args.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  BacktestingSymbolSupportResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = BacktestingSymbolSupportResponseDtoBuilder();
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

class BacktestingSymbolSupportResponseDtoStatusEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'supported')
  static const BacktestingSymbolSupportResponseDtoStatusEnum supported = _$backtestingSymbolSupportResponseDtoStatusEnum_supported;
  @BuiltValueEnumConst(wireName: r'refreshed_then_supported')
  static const BacktestingSymbolSupportResponseDtoStatusEnum refreshedThenSupported = _$backtestingSymbolSupportResponseDtoStatusEnum_refreshedThenSupported;
  @BuiltValueEnumConst(wireName: r'not_supported')
  static const BacktestingSymbolSupportResponseDtoStatusEnum notSupported = _$backtestingSymbolSupportResponseDtoStatusEnum_notSupported;

  static Serializer<BacktestingSymbolSupportResponseDtoStatusEnum> get serializer => _$backtestingSymbolSupportResponseDtoStatusEnumSerializer;

  const BacktestingSymbolSupportResponseDtoStatusEnum._(String name): super(name);

  static BuiltSet<BacktestingSymbolSupportResponseDtoStatusEnum> get values => _$backtestingSymbolSupportResponseDtoStatusEnumValues;
  static BacktestingSymbolSupportResponseDtoStatusEnum valueOf(String name) => _$backtestingSymbolSupportResponseDtoStatusEnumValueOf(name);
}

