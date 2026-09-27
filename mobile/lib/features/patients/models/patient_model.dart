class PatientModel {
  final int id;
  final String patientCode;
  final String name;
  final int? age;
  final DateTime createdAt;
  final DateTime updatedAt;

  PatientModel({
    required this.id,
    required this.patientCode,
    required this.name,
    this.age,
    required this.createdAt,
    required this.updatedAt,
  });

  factory PatientModel.fromJson(Map<String, dynamic> json) {
    return PatientModel(
      id: json['id'],
      patientCode: json['patientCode'] ?? '',
      name: json['name'] ?? '',
      age: json['age'],
      createdAt: DateTime.parse(json['createdAt']),
      updatedAt: DateTime.parse(json['updatedAt']),
    );
  }
}
