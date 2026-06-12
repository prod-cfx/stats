import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// One-shot bridge from `/ai/confirm` back to the live chat route.
///
/// The confirm page owns the backend publish flow. The chat page owns chat turns.
/// This handoff keeps that boundary explicit and lets `/ai` render the generated
/// script as real chat state instead of relying on route-only assertions.
class AiConfirmChatHandoff {
  const AiConfirmChatHandoff({required this.result});

  final CodegenSessionResponseDto result;
}

final aiConfirmChatHandoffProvider =
    NotifierProvider<AiConfirmChatHandoffNotifier, AiConfirmChatHandoff?>(
      AiConfirmChatHandoffNotifier.new,
    );

class AiConfirmChatHandoffNotifier extends Notifier<AiConfirmChatHandoff?> {
  @override
  AiConfirmChatHandoff? build() => null;

  void set(AiConfirmChatHandoff handoff) => state = handoff;

  void clear() => state = null;
}
