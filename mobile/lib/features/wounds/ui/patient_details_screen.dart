import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../patients/models/patient_model.dart';
import '../models/wound_model.dart';
import '../providers/wound_provider.dart';

class PatientDetailsScreen extends ConsumerWidget {
  final PatientModel patient;

  const PatientDetailsScreen({super.key, required this.patient});

  void _showAddWoundDialog(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => _AddWoundDialog(patientId: patient.id),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(woundsProvider(patient.id));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Patient Details'),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddWoundDialog(context, ref),
        tooltip: 'Add Wound',
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(woundsProvider(patient.id)),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: _buildPatientInfo(),
            ),
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(16, 24, 16, 16),
                child: Text(
                  'Wounds',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
              ),
            ),
            _buildWoundsList(context, state, ref),
          ],
        ),
      ),
    );
  }

  Widget _buildPatientInfo() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 32,
                backgroundColor: Colors.blue.shade50,
                child: Text(
                  patient.name.isNotEmpty ? patient.name.substring(0, 1).toUpperCase() : '?',
                  style: TextStyle(fontSize: 28, color: Colors.blue.shade700, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      patient.name,
                      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      patient.patientCode,
                      style: TextStyle(fontSize: 16, color: Colors.grey.shade600),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (patient.age != null) ...[
            const SizedBox(height: 24),
            Row(
              children: [
                const Icon(Icons.cake, size: 20, color: Colors.grey),
                const SizedBox(width: 8),
                Text('Age: ${patient.age} years', style: const TextStyle(fontSize: 16)),
              ],
            ),
          ]
        ],
      ),
    );
  }

  Widget _buildWoundsList(BuildContext context, AsyncValue<List<WoundModel>> state, WidgetRef ref) {
    return state.when(
      loading: () => const SliverToBoxAdapter(
        child: Padding(
          padding: EdgeInsets.all(32.0),
          child: Center(child: CircularProgressIndicator(color: Color(0xFF0D9488))),
        ),
      ),
      error: (error, stack) => SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 64, color: Colors.red.shade400),
              const SizedBox(height: 16),
              Text(
                error.toString().replaceAll('Exception: ', ''),
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 16, color: Colors.black87),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => ref.invalidate(woundsProvider(patient.id)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
      data: (wounds) {
        if (wounds.isEmpty) {
          return SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(32.0),
              child: Center(
                child: Column(
                  children: [
                    Icon(Icons.healing, size: 64, color: Colors.grey.shade300),
                    const SizedBox(height: 16),
                    const Text('No wounds found.', style: TextStyle(fontSize: 16, color: Colors.black54)),
                  ],
                ),
              ),
            ),
          );
        }

        return SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) => _buildWoundCard(context, wounds[index]),
              childCount: wounds.length,
            ),
          ),
        );
      },
    );
  }

  Widget _buildWoundCard(BuildContext context, WoundModel wound) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12.0),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: InkWell(
        onTap: () => context.push('/wounds/${wound.id}', extra: wound),
        borderRadius: BorderRadius.circular(12),
        child: ListTile(
          contentPadding: const EdgeInsets.all(16.0),
          leading: CircleAvatar(
            backgroundColor: Colors.orange.shade50,
            child: Icon(Icons.healing, color: Colors.orange.shade700),
          ),
          title: Text(wound.location, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          subtitle: wound.description != null && wound.description!.isNotEmpty
              ? Padding(
                  padding: const EdgeInsets.only(top: 8.0),
                  child: Text(wound.description!, style: TextStyle(color: Colors.grey.shade700)),
                )
              : null,
        ),
      ),
    );
  }
}

class _AddWoundDialog extends ConsumerStatefulWidget {
  final int patientId;
  const _AddWoundDialog({required this.patientId});

  @override
  ConsumerState<_AddWoundDialog> createState() => _AddWoundDialogState();
}

class _AddWoundDialogState extends ConsumerState<_AddWoundDialog> {
  final _formKey = GlobalKey<FormState>();
  final _locationController = TextEditingController();
  final _descriptionController = TextEditingController();
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _locationController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final descText = _descriptionController.text.trim();
      final desc = descText.isNotEmpty ? descText : null;
      
      await ref.read(woundServiceProvider).createWound(
        widget.patientId,
        _locationController.text.trim(),
        desc,
      );
      
      ref.invalidate(woundsProvider(widget.patientId));
      
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
      title: const Text('Add Wound'),
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
                controller: _locationController,
                decoration: const InputDecoration(labelText: 'Location *', hintText: 'e.g., Left Leg'),
                validator: (value) => value == null || value.trim().isEmpty ? 'Location is required' : null,
                enabled: !_isSubmitting,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _descriptionController,
                decoration: const InputDecoration(labelText: 'Description (Optional)', hintText: 'e.g., Small ulcer'),
                maxLines: 3,
                enabled: !_isSubmitting,
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
