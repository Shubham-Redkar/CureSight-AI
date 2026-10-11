import '../../assessments/models/assessment_model.dart';

class ProgressUtils {
  static num? getAreaRaw(AssessmentModel a) {
    bool? effectiveWoundDetected = a.woundDetected;
    if (a.verified && a.verifiedResult != null && a.verifiedResult!.containsKey('woundDetected')) {
      final override = a.verifiedResult!['woundDetected'];
      if (override is bool) effectiveWoundDetected = override;
    }

    if (effectiveWoundDetected == true) {
      if (a.verified && a.verifiedResult != null && a.verifiedResult!['measurements'] != null) {
        final m = a.verifiedResult!['measurements'];
        if (m is Map) {
          final overrideArea = m['total_area_cm2'] ?? m['areaCm2'];
          if (overrideArea != null && overrideArea is num && overrideArea >= 0) {
            return overrideArea;
          }
        }
      }
      if (a.measurements != null) {
        final area = a.measurements!['total_area_cm2'];
        if (area != null && area is num && area >= 0) {
          return area;
        }
      }
    }
    return null;
  }

  static double? calculateAreaChangePct(num? initialAreaRaw, num? currentAreaRaw) {
    if (initialAreaRaw != null && currentAreaRaw != null && initialAreaRaw > 0) {
      return ((currentAreaRaw - initialAreaRaw) / initialAreaRaw) * 100.0;
    }
    return null;
  }
}
