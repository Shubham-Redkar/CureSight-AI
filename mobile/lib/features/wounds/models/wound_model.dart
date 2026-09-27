class WoundModel {
  final int id;
  final int patientId;
  final String location;
  final String? description;
  final DateTime createdAt;
  final DateTime updatedAt;

  WoundModel({
    required this.id,
    required this.patientId,
    required this.location,
    this.description,
    required this.createdAt,
    required this.updatedAt,
  });

  factory WoundModel.fromJson(Map<String, dynamic> json) {
    return WoundModel(
      id: json['id'],
      patientId: json['patientId'],
      location: json['location'] ?? 'Unknown',
      description: json['description'],
      createdAt: DateTime.parse(json['createdAt']),
      updatedAt: DateTime.parse(json['updatedAt']),
    );
  }
}
