import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/wound_model.dart';
import '../services/wound_service.dart';

final woundServiceProvider = Provider<WoundService>((ref) {
  return WoundService();
});

final woundsProvider = FutureProvider.autoDispose.family<List<WoundModel>, int>((ref, patientId) async {
  return ref.read(woundServiceProvider).getWounds(patientId);
});
