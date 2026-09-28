class UserModel {
  final String id;
  final String username;
  final String role;

  UserModel({
    required this.id,
    required this.username,
    required this.role,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as String,
      username: json['username'] as String,
      role: json['role'] as String? ?? 'DOCTOR',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'role': role,
    };
  }
}
