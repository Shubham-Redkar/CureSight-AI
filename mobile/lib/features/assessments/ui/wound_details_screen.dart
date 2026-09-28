import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../wounds/models/wound_model.dart';
import '../models/assessment_model.dart';
import '../providers/assessment_provider.dart';

class WoundDetailsScreen extends ConsumerWidget {
  final WoundModel wound;

  const WoundDetailsScreen({super.key, required this.wound});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(assessmentsProvider(wound.id));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Wound Details'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/assessments/new', extra: wound),
        icon: const Icon(Icons.camera_alt),
        label: const Text('Analyze New Image'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(assessmentsProvider(wound.id)),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: _buildWoundInfo(context),
            ),
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(16, 24, 16, 16),
                child: Text(
                  'Assessments',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
              ),
            ),
            _buildAssessmentsList(context, state, ref),
          ],
        ),
      ),
    );
  }

  Widget _buildWoundInfo(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: Colors.orange.shade50,
                child: Icon(Icons.healing, color: Colors.orange.shade700, size: 28),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      wound.location,
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Wound ID: ${wound.id}',
                      style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (wound.description != null && wound.description!.isNotEmpty) ...[
            const SizedBox(height: 20),
            Text('Description', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.grey.shade700)),
            const SizedBox(height: 4),
            Text(wound.description!, style: const TextStyle(fontSize: 16)),
          ],
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => context.push('/wounds/${wound.id}/progress'),
              icon: const Icon(Icons.analytics_outlined),
              label: const Text('View Analytics'),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 12),
                foregroundColor: const Color(0xFF0D9488),
                side: const BorderSide(color: Color(0xFF0D9488)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAssessmentsList(BuildContext context, AsyncValue<List<AssessmentModel>> state, WidgetRef ref) {
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
                onPressed: () => ref.invalidate(assessmentsProvider(wound.id)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
      data: (assessments) {
        if (assessments.isEmpty) {
          return SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(32.0),
              child: Center(
                child: Column(
                  children: [
                    Icon(Icons.assignment_outlined, size: 64, color: Colors.grey.shade300),
                    const SizedBox(height: 16),
                    const Text('No assessments yet.', style: TextStyle(fontSize: 16, color: Colors.black54)),
                    const SizedBox(height: 8),
                    const Text('Tap "Analyze New Image" to begin.', style: TextStyle(fontSize: 14, color: Colors.black38)),
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
              (context, index) => _buildAssessmentCard(context, assessments[index]),
              childCount: assessments.length,
            ),
          ),
        );
      },
    );
  }

  Widget _buildAssessmentCard(BuildContext context, AssessmentModel assessment) {
    final date = assessment.assessmentDate.toLocal();
    final dateString = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    
    Color statusColor = Colors.grey;
    if (assessment.status == 'COMPLETED') statusColor = Colors.green;
    if (assessment.status == 'PENDING') statusColor = Colors.amber;

    return Card(
      margin: const EdgeInsets.only(bottom: 12.0),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: InkWell(
        onTap: () => context.push('/assessments/${assessment.id}', extra: assessment),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: statusColor.withValues(alpha: 0.1),
                child: Icon(Icons.assignment, color: statusColor),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(dateString, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    const SizedBox(height: 4),
                    Text('Status: ${assessment.status}', style: TextStyle(color: Colors.grey.shade700, fontSize: 13)),
                    if (assessment.woundDetected == false) ...[
                      const SizedBox(height: 2),
                      const Text('Result: No wound detected', style: TextStyle(color: Colors.red, fontSize: 13)),
                    ]
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: Colors.grey),
            ],
          ),
        ),
      ),
    );
  }
}
