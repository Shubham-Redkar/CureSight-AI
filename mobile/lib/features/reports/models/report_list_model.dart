class ReportListResponse {
  final List<ReportListItemModel> reports;
  final ReportPaginationModel? pagination;

  ReportListResponse({required this.reports, this.pagination});

  factory ReportListResponse.fromJson(Map<String, dynamic> json) {
    return ReportListResponse(
      reports: (json['reports'] as List?)
          ?.map((e) => ReportListItemModel.fromJson(e as Map<String, dynamic>))
          .toList() ?? [],
      pagination: json['pagination'] != null 
          ? ReportPaginationModel.fromJson(json['pagination']) 
          : null,
    );
  }
}

class ReportPaginationModel {
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  ReportPaginationModel({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  factory ReportPaginationModel.fromJson(Map<String, dynamic> json) {
    return ReportPaginationModel(
      page: json['page'] as int,
      limit: json['limit'] as int,
      total: json['total'] as int,
      totalPages: json['totalPages'] as int,
    );
  }
}

class ReportListItemModel {
  final int id;
  final int woundId;
  final DateTime assessmentDate;
  final String status;
  final bool verified;
  final ReportListWoundModel wound;

  ReportListItemModel({
    required this.id,
    required this.woundId,
    required this.assessmentDate,
    required this.status,
    required this.verified,
    required this.wound,
  });

  factory ReportListItemModel.fromJson(Map<String, dynamic> json) {
    return ReportListItemModel(
      id: json['id'] as int,
      woundId: json['woundId'] as int,
      assessmentDate: DateTime.parse(json['assessmentDate'] as String),
      status: json['status'] as String,
      verified: json['verified'] as bool? ?? false,
      wound: ReportListWoundModel.fromJson(json['wound'] as Map<String, dynamic>),
    );
  }
}

class ReportListWoundModel {
  final int id;
  final String location;
  final ReportListPatientModel patient;

  ReportListWoundModel({
    required this.id,
    required this.location,
    required this.patient,
  });

  factory ReportListWoundModel.fromJson(Map<String, dynamic> json) {
    return ReportListWoundModel(
      id: json['id'] as int,
      location: json['location'] as String,
      patient: ReportListPatientModel.fromJson(json['patient'] as Map<String, dynamic>),
    );
  }
}

class ReportListPatientModel {
  final int id;
  final String patientCode;
  final String name;

  ReportListPatientModel({
    required this.id,
    required this.patientCode,
    required this.name,
  });

  factory ReportListPatientModel.fromJson(Map<String, dynamic> json) {
    return ReportListPatientModel(
      id: json['id'] as int,
      patientCode: json['patientCode'] as String,
      name: json['name'] as String,
    );
  }
}
