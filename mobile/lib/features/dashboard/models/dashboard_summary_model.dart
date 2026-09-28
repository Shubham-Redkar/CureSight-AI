class DashboardSummaryModel {
  final int totalPatients;
  final int activeWounds;
  final int pendingReview;
  final int verifiedAssessments;
  final List<RecentAssessmentModel> recentAssessments;

  DashboardSummaryModel({
    required this.totalPatients,
    required this.activeWounds,
    required this.pendingReview,
    required this.verifiedAssessments,
    required this.recentAssessments,
  });

  factory DashboardSummaryModel.fromJson(Map<String, dynamic> json) {
    return DashboardSummaryModel(
      totalPatients: json['totalPatients'] ?? 0,
      activeWounds: json['activeWounds'] ?? 0,
      pendingReview: json['pendingReview'] ?? 0,
      verifiedAssessments: json['verifiedAssessments'] ?? 0,
      recentAssessments: (json['recentAssessments'] as List?)
              ?.map((e) => RecentAssessmentModel.fromJson(e))
              .toList() ??
          [],
    );
  }
}

class RecentAssessmentModel {
  final int id;
  final int woundId;
  final DateTime assessmentDate;
  final String status;
  final bool verified;
  final DateTime createdAt;
  final RecentWoundModel? wound;

  RecentAssessmentModel({
    required this.id,
    required this.woundId,
    required this.assessmentDate,
    required this.status,
    required this.verified,
    required this.createdAt,
    this.wound,
  });

  factory RecentAssessmentModel.fromJson(Map<String, dynamic> json) {
    return RecentAssessmentModel(
      id: json['id'],
      woundId: json['woundId'],
      assessmentDate: DateTime.parse(json['assessmentDate']),
      status: json['status'] ?? 'PENDING',
      verified: json['verified'] ?? false,
      createdAt: DateTime.parse(json['createdAt']),
      wound: json['wound'] != null ? RecentWoundModel.fromJson(json['wound']) : null,
    );
  }
}

class RecentWoundModel {
  final int id;
  final int patientId;
  final String location;
  final RecentPatientModel? patient;

  RecentWoundModel({
    required this.id,
    required this.patientId,
    required this.location,
    this.patient,
  });

  factory RecentWoundModel.fromJson(Map<String, dynamic> json) {
    return RecentWoundModel(
      id: json['id'],
      patientId: json['patientId'],
      location: json['location'] ?? 'Unknown',
      patient: json['patient'] != null ? RecentPatientModel.fromJson(json['patient']) : null,
    );
  }
}

class RecentPatientModel {
  final int id;
  final String patientCode;
  final String name;

  RecentPatientModel({
    required this.id,
    required this.patientCode,
    required this.name,
  });

  factory RecentPatientModel.fromJson(Map<String, dynamic> json) {
    return RecentPatientModel(
      id: json['id'],
      patientCode: json['patientCode'] ?? '',
      name: json['name'] ?? 'Unknown',
    );
  }
}
