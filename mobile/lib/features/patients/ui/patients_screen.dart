import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/patient_provider.dart';
import '../models/patient_model.dart';
import '../../../core/widgets/app_drawer.dart';

class PatientsScreen extends ConsumerWidget {
  const PatientsScreen({super.key});

  void _showAddPatientDialog(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => _AddPatientDialog(),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(patientsProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Patients'),
      ),
      drawer: const AppDrawer(),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddPatientDialog(context, ref),
        tooltip: 'Add Patient',
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(patientsProvider.notifier).loadPatients(),
        child: _buildBody(context, state, ref),
      ),
    );
  }

  Widget _buildBody(BuildContext context, PatientsState state, WidgetRef ref) {
    if (state.isLoading && state.patients == null) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF0D9488)));
    }

    if (state.error != null && state.patients == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 64, color: Colors.red.shade400),
              const SizedBox(height: 16),
              Text(
                state.error!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 16, color: Colors.black87),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => ref.read(patientsProvider.notifier).loadPatients(),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final patients = state.patients ?? [];

    if (patients.isEmpty) {
      return CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverFillRemaining(
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.people_outline, size: 80, color: Colors.grey.shade400),
                  const SizedBox(height: 16),
                  const Text('No patients found.', style: TextStyle(fontSize: 18, color: Colors.black54)),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    icon: const Icon(Icons.add),
                    label: const Text('Add Patient'),
                    onPressed: () => _showAddPatientDialog(context, ref),
                  ),
                ],
              ),
            ),
          ),
        ],
      );
    }

    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
      itemCount: patients.length,
      itemBuilder: (context, index) {
        return _buildPatientCard(context, patients[index]);
      },
    );
  }

  Widget _buildPatientCard(BuildContext context, PatientModel patient) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12.0),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: ListTile(
        onTap: () => context.go('/patients/${patient.id}', extra: patient),
        contentPadding: const EdgeInsets.all(16.0),
        leading: CircleAvatar(
          backgroundColor: Colors.blue.shade50,
          child: Text(
            patient.name.isNotEmpty ? patient.name.substring(0, 1).toUpperCase() : '?',
            style: TextStyle(color: Colors.blue.shade700, fontWeight: FontWeight.bold),
          ),
        ),
        title: Text(patient.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 8.0),
          child: Row(
            children: [
              const Icon(Icons.badge, size: 14, color: Colors.grey),
              const SizedBox(width: 4),
              Text(patient.patientCode, style: TextStyle(color: Colors.grey.shade700)),
              if (patient.age != null) ...[
                const SizedBox(width: 16),
                const Icon(Icons.cake, size: 14, color: Colors.grey),
                const SizedBox(width: 4),
                Text('${patient.age} yrs', style: TextStyle(color: Colors.grey.shade700)),
              ]
            ],
          ),
        ),
      ),
    );
  }
}

class _AddPatientDialog extends ConsumerStatefulWidget {
  @override
  ConsumerState<_AddPatientDialog> createState() => _AddPatientDialogState();
}

class _AddPatientDialogState extends ConsumerState<_AddPatientDialog> {
  final _formKey = GlobalKey<FormState>();
  final _codeController = TextEditingController();
  final _nameController = TextEditingController();
  final _ageController = TextEditingController();
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _codeController.dispose();
    _nameController.dispose();
    _ageController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final ageText = _ageController.text.trim();
      final age = ageText.isNotEmpty ? int.tryParse(ageText) : null;
      
      await ref.read(patientsProvider.notifier).createPatient(
        _codeController.text.trim(),
        _nameController.text.trim(),
        age,
      );
      
      if (mounted) {
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = e.toString().replaceAll('Exception: ', '');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Add Patient'),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_errorMessage != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.error_outline, color: Colors.red.shade700, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: TextStyle(color: Colors.red.shade700, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),
              TextFormField(
                controller: _codeController,
                decoration: const InputDecoration(labelText: 'Patient Code *', hintText: 'e.g., P-1001'),
                validator: (value) => value == null || value.trim().isEmpty ? 'Patient Code is required' : null,
                enabled: !_isSubmitting,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'Full Name *', hintText: 'e.g., Jane Doe'),
                validator: (value) => value == null || value.trim().isEmpty ? 'Name is required' : null,
                enabled: !_isSubmitting,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _ageController,
                decoration: const InputDecoration(labelText: 'Age (Optional)', hintText: 'e.g., 34'),
                keyboardType: TextInputType.number,
                enabled: !_isSubmitting,
                validator: (value) {
                  if (value != null && value.trim().isNotEmpty) {
                    if (int.tryParse(value) == null) {
                      return 'Enter a valid number';
                    }
                  }
                  return null;
                },
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: _isSubmitting ? null : _submit,
          child: _isSubmitting
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Text('Create'),
        ),
      ],
    );
  }
}
