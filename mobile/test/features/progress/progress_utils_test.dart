import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/progress/utils/progress_utils.dart';
import 'package:mobile/features/assessments/models/assessment_model.dart';

void main() {
  group('ProgressUtils', () {
    group('calculateAreaChangePct', () {
      test('calculates positive percentage change (area increases)', () {
        expect(ProgressUtils.calculateAreaChangePct(10.0, 15.0), 50.0);
      });

      test('calculates negative percentage change (area decreases)', () {
        expect(ProgressUtils.calculateAreaChangePct(10.0, 5.0), -50.0);
      });

      test('returns 0 for no change', () {
        expect(ProgressUtils.calculateAreaChangePct(10.0, 10.0), 0.0);
      });

      test('returns null if baseline is zero to prevent division by zero', () {
        expect(ProgressUtils.calculateAreaChangePct(0.0, 5.0), null);
      });

      test('returns null if any area is missing', () {
        expect(ProgressUtils.calculateAreaChangePct(null, 5.0), null);
        expect(ProgressUtils.calculateAreaChangePct(10.0, null), null);
        expect(ProgressUtils.calculateAreaChangePct(null, null), null);
      });

      test('returns null if baseline is negative', () {
        expect(ProgressUtils.calculateAreaChangePct(-5.0, 5.0), null);
      });
    });

    group('getAreaRaw', () {
      test('returns null if no measurements', () {
        final ass = AssessmentModel(
          id: 1, woundId: 1, assessmentDate: DateTime.now(), status: 'COMPLETED', verified: false, woundDetected: true
        );
        expect(ProgressUtils.getAreaRaw(ass), null);
      });

      test('returns area if wound detected and measurements exist', () {
        final ass = AssessmentModel(
          id: 1, woundId: 1, assessmentDate: DateTime.now(), status: 'COMPLETED', verified: false, woundDetected: true,
          measurements: {'total_area_cm2': 12.5}
        );
        expect(ProgressUtils.getAreaRaw(ass), 12.5);
      });

      test('returns null if woundDetected is false', () {
        final ass = AssessmentModel(
          id: 1, woundId: 1, assessmentDate: DateTime.now(), status: 'COMPLETED', verified: false, woundDetected: false,
          measurements: {'total_area_cm2': 12.5}
        );
        expect(ProgressUtils.getAreaRaw(ass), null);
      });

      test('returns area if verified override says woundDetected true', () {
        final ass = AssessmentModel(
          id: 1, woundId: 1, assessmentDate: DateTime.now(), status: 'VERIFIED', verified: true, woundDetected: false,
          verifiedResult: {'woundDetected': true},
          measurements: {'total_area_cm2': 10.0}
        );
        expect(ProgressUtils.getAreaRaw(ass), 10.0);
      });

      test('returns overridden area when verifiedResult contains measurement override', () {
        final ass = AssessmentModel(
          id: 1, woundId: 1, assessmentDate: DateTime.now(), status: 'VERIFIED', verified: true, woundDetected: true,
          verifiedResult: {'measurements': {'total_area_cm2': 8.5}},
          measurements: {'total_area_cm2': 10.0}
        );
        expect(ProgressUtils.getAreaRaw(ass), 8.5);
      });
    });
  });
}
