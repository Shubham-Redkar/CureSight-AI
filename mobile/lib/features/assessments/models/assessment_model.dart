class AssessmentModel {
  final int id;
  final int woundId;
  final DateTime assessmentDate;
  final String status;
  final String? imageKey;
  final String? annotatedImageKey;
  final Map<String, dynamic>? measurements;
  final bool? woundDetected;
  final bool verified;
  final Map<String, dynamic>? verifiedResult;
  final String? notes;

  AssessmentModel({
    required this.id,
    required this.woundId,
    required this.assessmentDate,
    required this.status,
    this.imageKey,
    this.annotatedImageKey,
    this.measurements,
    this.woundDetected,
    required this.verified,
    this.verifiedResult,
    this.notes,
  });

  factory AssessmentModel.fromJson(Map<String, dynamic> json) {
    return AssessmentModel(
      id: json['id'] as int,
      woundId: json['woundId'] as int,
      assessmentDate: DateTime.parse(json['assessmentDate'] as String),
      status: json['status'] as String,
      imageKey: json['imageKey'] as String?,
      annotatedImageKey: json['annotatedImageKey'] as String?,
      measurements: json['measurements'] as Map<String, dynamic>?,
      woundDetected: json['woundDetected'] as bool?,
      verified: json['verified'] as bool? ?? false,
      verifiedResult: json['verifiedResult'] as Map<String, dynamic>?,
      notes: json['notes'] as String?,
    );
  }
}
