import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/patient_model.dart';
import '../services/patient_service.dart';

final patientServiceProvider = Provider<PatientService>((ref) {
  return PatientService();
});

class PatientsState {
  final bool isLoading;
  final List<PatientModel>? patients;
  final String? error;

  const PatientsState({
    this.isLoading = false,
    this.patients,
    this.error,
  });

  PatientsState copyWith({
    bool? isLoading,
    List<PatientModel>? patients,
    String? error,
  }) {
    return PatientsState(
      isLoading: isLoading ?? this.isLoading,
      patients: patients ?? this.patients,
      error: error,
    );
  }
}

class PatientsNotifier extends Notifier<PatientsState> {
  @override
  PatientsState build() {
    Future.microtask(() => loadPatients());
    return const PatientsState(isLoading: true);
  }

  Future<void> loadPatients() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final patients = await ref.read(patientServiceProvider).getPatients();
      state = PatientsState(isLoading: false, patients: patients);
    } catch (e) {
      state = PatientsState(
        isLoading: false,
        patients: null,
        error: e.toString().replaceAll('Exception: ', ''),
      );
    }
  }

  Future<void> createPatient(String patientCode, String name, int? age) async {
    final newPatient = await ref.read(patientServiceProvider).createPatient(patientCode, name, age);
    if (state.patients != null) {
      state = state.copyWith(
        patients: [...state.patients!, newPatient],
      );
    } else {
      await loadPatients();
    }
  }
}

final patientsProvider = NotifierProvider<PatientsNotifier, PatientsState>(() {
  return PatientsNotifier();
});
