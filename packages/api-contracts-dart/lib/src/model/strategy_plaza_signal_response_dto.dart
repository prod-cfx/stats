//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'strategy_plaza_signal_response_dto.g.dart';

/// StrategyPlazaSignalResponseDto
///
/// Properties:
/// * [time] - 信号时间
/// * [side] - 信号方向
/// * [price] - 信号价格
/// * [pnlPercent] - 信号收益百分比
@BuiltValue()
abstract class StrategyPlazaSignalResponseDto implements Built<StrategyPlazaSignalResponseDto, StrategyPlazaSignalResponseDtoBuilder> {
  /// 信号时间
  @BuiltValueField(wireName: r'time')
  String get time;

  /// 信号方向
  @BuiltValueField(wireName: r'side')
  StrategyPlazaSignalResponseDtoSideEnum get side;
  // enum sideEnum {  buy,  sell,  };

  /// 信号价格
  @BuiltValueField(wireName: r'price')
  num get price;

  /// 信号收益百分比
  @BuiltValueField(wireName: r'pnlPercent')
  num get pnlPercent;

  StrategyPlazaSignalResponseDto._();

  factory StrategyPlazaSignalResponseDto([void updates(StrategyPlazaSignalResponseDtoBuilder b)]) = _$StrategyPlazaSignalResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(StrategyPlazaSignalResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<StrategyPlazaSignalResponseDto> get serializer => _$StrategyPlazaSignalResponseDtoSerializer();
}

class _$StrategyPlazaSignalResponseDtoSerializer implements PrimitiveSerializer<StrategyPlazaSignalResponseDto> {
  @override
  final Iterable<Type> types = const [StrategyPlazaSignalResponseDto, _$StrategyPlazaSignalResponseDto];

  @override
  final String wireName = r'StrategyPlazaSignalResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    StrategyPlazaSignalResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'time';
    yield serializers.serialize(
      object.time,
      specifiedType: const FullType(String),
    );
    yield r'side';
    yield serializers.serialize(
      object.side,
      specifiedType: const FullType(StrategyPlazaSignalResponseDtoSideEnum),
    );
    yield r'price';
    yield serializers.serialize(
      object.price,
      specifiedType: const FullType(num),
    );
    yield r'pnlPercent';
    yield serializers.serialize(
      object.pnlPercent,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    StrategyPlazaSignalResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required StrategyPlazaSignalResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'time':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.time = valueDes;
          break;
        case r'side':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(StrategyPlazaSignalResponseDtoSideEnum),
          ) as StrategyPlazaSignalResponseDtoSideEnum;
          result.side = valueDes;
          break;
        case r'price':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.price = valueDes;
          break;
        case r'pnlPercent':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.pnlPercent = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  StrategyPlazaSignalResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = StrategyPlazaSignalResponseDtoBuilder();
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

class StrategyPlazaSignalResponseDtoSideEnum extends EnumClass {

  /// 信号方向
  @BuiltValueEnumConst(wireName: r'buy')
  static const StrategyPlazaSignalResponseDtoSideEnum buy = _$strategyPlazaSignalResponseDtoSideEnum_buy;
  /// 信号方向
  @BuiltValueEnumConst(wireName: r'sell')
  static const StrategyPlazaSignalResponseDtoSideEnum sell = _$strategyPlazaSignalResponseDtoSideEnum_sell;

  static Serializer<StrategyPlazaSignalResponseDtoSideEnum> get serializer => _$strategyPlazaSignalResponseDtoSideEnumSerializer;

  const StrategyPlazaSignalResponseDtoSideEnum._(String name): super(name);

  static BuiltSet<StrategyPlazaSignalResponseDtoSideEnum> get values => _$strategyPlazaSignalResponseDtoSideEnumValues;
  static StrategyPlazaSignalResponseDtoSideEnum valueOf(String name) => _$strategyPlazaSignalResponseDtoSideEnumValueOf(name);
}

