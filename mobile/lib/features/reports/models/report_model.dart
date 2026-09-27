class PatientInfo {
  final int id;
  final String patientCode;
  final String name;
  final int? age;

  PatientInfo({
    required this.id,
    required this.patientCode,
    required this.name,
    this.age,
  });

  factory PatientInfo.fromJson(Map<String, dynamic> json) {
    return PatientInfo(
      id: json['id'] as int,
      patientCode: json['patientCode'] as String,
      name: json['name'] as String,
      age: json['age'] as int?,
    );
  }
}

class WoundInfo {
  final int id;
  final int patientId;
  final String location;
  final String? description;

  WoundInfo({
    required this.id,
    required this.patientId,
    required this.location,
    this.description,
  });

  factory WoundInfo.fromJson(Map<String, dynamic> json) {
    return WoundInfo(
      id: json['id'] as int,
      patientId: json['patientId'] as int,
      location: json['location'] as String,
      description: json['description'] as String?,
    );
  }
}

class AssessmentInfo {
  final int id;
  final int woundId;
  final DateTime assessmentDate;
  final String status;
  final bool? woundDetected;
  final String? notes;
  final Map<String, dynamic>? measurements;

  AssessmentInfo({
    required this.id,
    required this.woundId,
    required this.assessmentDate,
    required this.status,
    this.woundDetected,
    this.notes,
    this.measurements,
  });

  factory AssessmentInfo.fromJson(Map<String, dynamic> json) {
    return AssessmentInfo(
      id: json['id'] as int,
      woundId: json['woundId'] as int,
      assessmentDate: DateTime.parse(json['assessmentDate'] as String),
      status: json['status'] as String,
      woundDetected: json['woundDetected'] as bool?,
      notes: json['notes'] as String?,
      measurements: json['measurements'] as Map<String, dynamic>?,
    );
  }
}

class ImageUrls {
  final String? originalUrl;
  final String? annotatedUrl;

  ImageUrls({
    this.originalUrl,
    this.annotatedUrl,
  });

  factory ImageUrls.fromJson(Map<String, dynamic> json) {
    return ImageUrls(
      originalUrl: json['originalUrl'] as String?,
      annotatedUrl: json['annotatedUrl'] as String?,
    );
  }
}

class PreviousAssessment {
  final int id;
  final DateTime date;
  final num areaCm2;

  PreviousAssessment({
    required this.id,
    required this.date,
    required this.areaCm2,
  });

  factory PreviousAssessment.fromJson(Map<String, dynamic> json) {
    return PreviousAssessment(
      id: json['id'] as int,
      date: DateTime.parse(json['date'] as String),
      areaCm2: json['area_cm2'] as num,
    );
  }
}

class ProgressInfo {
  final PreviousAssessment? previousAssessment;
  final num? currentAreaCm2;
  final num? areaChangePct;
  final String status; // "improving" | "worsening" | "stable" | "insufficient_data"

  ProgressInfo({
    this.previousAssessment,
    this.currentAreaCm2,
    this.areaChangePct,
    required this.status,
  });

  factory ProgressInfo.fromJson(Map<String, dynamic> json) {
    return ProgressInfo(
      previousAssessment: json['previousAssessment'] != null
          ? PreviousAssessment.fromJson(json['previousAssessment'] as Map<String, dynamic>)
          : null,
      currentAreaCm2: json['currentArea_cm2'] as num?,
      areaChangePct: json['areaChangePct'] as num?,
      status: json['status'] as String,
    );
  }
}

class ClinicalReportModel {
  final PatientInfo patient;
  final WoundInfo wound;
  final AssessmentInfo assessment;
  final ImageUrls images;
  final ProgressInfo progress;

  ClinicalReportModel({
    required this.patient,
    required this.wound,
    required this.assessment,
    required this.images,
    required this.progress,
  });

  factory ClinicalReportModel.fromJson(Map<String, dynamic> json) {
    return ClinicalReportModel(
      patient: PatientInfo.fromJson(json['patient'] as Map<String, dynamic>),
      wound: WoundInfo.fromJson(json['wound'] as Map<String, dynamic>),
      assessment: AssessmentInfo.fromJson(json['assessment'] as Map<String, dynamic>),
      images: ImageUrls.fromJson(json['images'] as Map<String, dynamic>),
      progress: ProgressInfo.fromJson(json['progress'] as Map<String, dynamic>),
    );
  }
}
