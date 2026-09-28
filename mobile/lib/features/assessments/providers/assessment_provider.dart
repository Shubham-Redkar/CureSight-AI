import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/assessment_model.dart';
import '../services/assessment_service.dart';

final assessmentServiceProvider = Provider<AssessmentService>((ref) {
  return AssessmentService();
});

final assessmentsProvider = FutureProvider.autoDispose.family<List<AssessmentModel>, int>((ref, woundId) async {
  return ref.read(assessmentServiceProvider).getAssessments(woundId);
});

// A provider to cache the last newly created assessment if we need to pass it around,
// or we can just invalidate the list and let the new one show up at the top.
