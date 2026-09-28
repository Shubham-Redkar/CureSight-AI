import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../models/assessment_model.dart';
import '../providers/assessment_provider.dart';
import '../../auth/providers/auth_provider.dart';
import '../../../core/config/env_config.dart';
import '../../../core/network/dio_client.dart';

class AssessmentDetailScreen extends ConsumerStatefulWidget {
  final AssessmentModel assessment;

  const AssessmentDetailScreen({super.key, required this.assessment});

  @override
  ConsumerState<AssessmentDetailScreen> createState() => _AssessmentDetailScreenState();
}

class _AssessmentDetailScreenState extends ConsumerState<AssessmentDetailScreen> {
  bool _isVerifying = false;

  @override
  Widget build(BuildContext context) {
    // Optionally listen to assessment updates to reflect verification changes.
    final asyncAssessments = ref.watch(assessmentsProvider(widget.assessment.woundId));
    final assessment = asyncAssessments.maybeWhen(
      data: (list) => list.firstWhere((a) => a.id == widget.assessment.id, orElse: () => widget.assessment),
      orElse: () => widget.assessment,
    );
    
    final date = assessment.assessmentDate.toLocal();
    final dateString = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Assessment Result'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildStatusCard(dateString, assessment),
            const SizedBox(height: 16),
            _buildImagesSection(assessment),
            const SizedBox(height: 16),
            _buildMeasurementsSection(assessment),
            const SizedBox(height: 16),
            if (assessment.verified && assessment.verifiedResult != null) ...[
              _buildVerifiedResultSection(assessment),
              const SizedBox(height: 16),
            ],
            if (!assessment.verified) _buildVerifySection(context, assessment),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => context.push('/reports/${assessment.id}'),
                icon: const Icon(Icons.analytics_outlined),
                label: const Text('View Clinical Report'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  backgroundColor: const Color(0xFF0D9488),
                  foregroundColor: Colors.white,
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusCard(String dateString, AssessmentModel assessment) {
    Color statusColor = Colors.grey;
    if (assessment.status == 'COMPLETED') statusColor = Colors.green;
    if (assessment.status == 'PENDING') statusColor = Colors.amber;
    
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(dateString, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(
                  assessment.status,
                  style: TextStyle(color: statusColor, fontWeight: FontWeight.bold, fontSize: 12),
                ),
              ),
            ],
          ),
          if (assessment.woundDetected != null) ...[
            const SizedBox(height: 16),
            Row(
              children: [
                Icon(
                  assessment.woundDetected! ? Icons.check_circle : Icons.cancel,
                  color: assessment.woundDetected! ? Colors.green : Colors.red,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Text(
                  assessment.woundDetected! ? 'Wound Detected' : 'No Wound Detected',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: assessment.woundDetected! ? Colors.green.shade700 : Colors.red.shade700,
                  ),
                ),
              ],
            ),
          ],
          if (assessment.notes != null && assessment.notes!.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text('Notes:', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text(assessment.notes!),
          ],
        ],
      ),
    );
  }

  Widget _buildImagesSection(AssessmentModel assessment) {
    if (assessment.imageKey == null && assessment.annotatedImageKey == null) {
      return const SizedBox.shrink();
    }

    final baseUrl = EnvConfig.apiBaseUrl;
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Images',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
        ),
        const SizedBox(height: 12),
        if (assessment.annotatedImageKey != null) ...[
          const Text('AI Annotated Result', style: TextStyle(fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: _AuthenticatedImage(
              imageUrl: '$baseUrl/images/${assessment.annotatedImageKey}',
            ),
          ),
          const SizedBox(height: 16),
        ],
        if (assessment.imageKey != null) ...[
          const Text('Original Upload', style: TextStyle(fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: _AuthenticatedImage(
              imageUrl: '$baseUrl/images/${assessment.imageKey}',
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildMeasurementsSection(AssessmentModel assessment) {
    final m = assessment.measurements;
    
    // Evaluate effective wound state
    bool aiDetected = assessment.woundDetected ?? false;
    bool effectiveWoundDetected = aiDetected;
    
    if (assessment.verified && assessment.verifiedResult != null) {
      final vResult = assessment.verifiedResult!;
      if (vResult['woundDetected'] is bool) {
         effectiveWoundDetected = vResult['woundDetected'] as bool;
      }
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Physical Measurements
          const Text(
            'Physical Measurements',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 12),
          ..._buildPhysicalMeasurementsList(assessment, m, effectiveWoundDetected),
          
          const SizedBox(height: 24),
          
          // AI Analysis
          const Text(
            'AI Analysis',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 12),
          _MeasurementRow(
            label: 'Wound Detection', 
            value: aiDetected ? 'Detected' : 'No wound detected'
          ),
          if (aiDetected && m != null) ...[
            _MeasurementRow(
              label: 'Color Classification', 
              value: m['color_classification'] is Map 
                  ? '${m['color_classification']['emoji'] ?? ''} ${m['color_classification']['label'] ?? 'N/A'}' 
                  : '${m['color_classification'] ?? 'N/A'}',
            ),
            _MeasurementRow(
              label: 'Calibration', 
              value: m['physical_measurement_available'] == true ? 'Available' : 'Unavailable',
            ),
          ],
          
          if (assessment.verified) ...[
            const SizedBox(height: 24),
            const Text(
              'Doctor Verification',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
            ),
            const SizedBox(height: 12),
            if (assessment.verifiedResult != null && assessment.verifiedResult!['woundDetected'] is bool)
              _MeasurementRow(
                label: 'Wound Detection', 
                value: assessment.verifiedResult!['woundDetected'] == true ? 'Wound confirmed' : 'No wound detected'
              ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.verified, color: Colors.blue, size: 16),
                const SizedBox(width: 8),
                Text('Verified', style: TextStyle(color: Colors.blue.shade700, fontWeight: FontWeight.w500)),
              ],
            ),
          ]
        ],
      ),
    );
  }

  List<Widget> _buildPhysicalMeasurementsList(AssessmentModel assessment, Map<String, dynamic>? m, bool effectiveWoundDetected) {
    if (!effectiveWoundDetected) {
      return [const Text('Not available', style: TextStyle(color: Colors.grey, fontStyle: FontStyle.italic))];
    }
    
    if (m == null || m.isEmpty) {
      return [const Text('No data available', style: TextStyle(color: Colors.grey, fontStyle: FontStyle.italic))];
    }

    final woundsList = m['wounds'] as List<dynamic>? ?? [];
    final hasExactlyOneWound = woundsList.length == 1;
    final hasMultipleWounds = woundsList.length > 1;

    final widgets = <Widget>[];
    
    // Overall Measurements
    widgets.add(_MeasurementRow(label: 'Total Area', value: m['total_area_cm2'] != null ? '${(m['total_area_cm2'] as num).toStringAsFixed(2)} cm²' : 'N/A'));
    widgets.add(_MeasurementRow(label: 'Total Perimeter', value: m['total_perimeter_cm'] != null ? '${(m['total_perimeter_cm'] as num).toStringAsFixed(2)} cm' : 'N/A'));
    widgets.add(_MeasurementRow(label: 'Wound Count', value: '${m['wound_count'] ?? 'N/A'}'));
    
    if (hasExactlyOneWound) {
      final firstWound = woundsList.first as Map<String, dynamic>;
      final length = firstWound['length_cm'];
      final width = firstWound['width_cm'];
      widgets.add(_MeasurementRow(label: 'Length', value: length != null ? '${(length as num).toStringAsFixed(2)} cm' : 'N/A'));
      widgets.add(_MeasurementRow(label: 'Width', value: width != null ? '${(width as num).toStringAsFixed(2)} cm' : 'N/A'));
    }
    
    if (m['physical_measurement_available'] == true) {
      widgets.add(const SizedBox(height: 8));
      widgets.add(const Text(
        '* Measurements are calibrated using the reference object.',
        style: TextStyle(fontSize: 12, color: Colors.green, fontStyle: FontStyle.italic),
      ));
    } else {
      widgets.add(const SizedBox(height: 8));
      widgets.add(const Text(
        '* Measurements are uncalibrated (no reference object found). Values may not be accurate in real-world units.',
        style: TextStyle(fontSize: 12, color: Colors.orange, fontStyle: FontStyle.italic),
      ));
    }

    // Multiple Wounds Section
    if (hasMultipleWounds) {
      widgets.add(const SizedBox(height: 24));
      widgets.add(const Text(
        'Wound Dimensions',
        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
      ));
      widgets.add(const SizedBox(height: 12));
      
      for (int i = 0; i < woundsList.length; i++) {
        final w = woundsList[i] as Map<String, dynamic>;
        
        widgets.add(
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.only(top: 12, left: 12, right: 12),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Wound ${i + 1}', style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                const SizedBox(height: 12),
                _MeasurementRow(label: 'Length', value: w['length_cm'] != null ? '${(w['length_cm'] as num).toStringAsFixed(2)} cm' : 'N/A'),
                _MeasurementRow(label: 'Width', value: w['width_cm'] != null ? '${(w['width_cm'] as num).toStringAsFixed(2)} cm' : 'N/A'),
                _MeasurementRow(label: 'Area', value: w['area_cm2'] != null ? '${(w['area_cm2'] as num).toStringAsFixed(2)} cm²' : 'N/A'),
                _MeasurementRow(label: 'Perimeter', value: w['perimeter_cm'] != null ? '${(w['perimeter_cm'] as num).toStringAsFixed(2)} cm' : 'N/A'),
                if (w['detection_confidence'] != null)
                  _MeasurementRow(label: 'Confidence', value: '${((w['detection_confidence'] as num) * 100).toStringAsFixed(0)}%'),
              ],
            ),
          )
        );
      }
    }
    
    return widgets;
  }

  Widget _buildVerifySection(BuildContext context, AssessmentModel assessment) {
    final user = ref.watch(authProvider).user;
    if (user == null || (user.role != 'DOCTOR' && user.role != 'ADMIN')) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.blue.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Doctor Verification',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 8),
          const Text('Review AI analysis and submit clinical conclusion.'),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _isVerifying ? null : () => _showVerificationDialog(context, assessment),
              icon: const Icon(Icons.verified_user),
              label: Text(_isVerifying ? 'Verifying...' : 'Verify Assessment'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showVerificationDialog(BuildContext context, AssessmentModel assessment) {
    bool? overrideWoundDetected = assessment.woundDetected;
    final notesController = TextEditingController();

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: const Text('Verify Assessment'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Wound Detected Override:'),
                    DropdownButton<bool?>(
                      value: overrideWoundDetected,
                      isExpanded: true,
                      items: const [
                        DropdownMenuItem(value: null, child: Text('Keep AI Result')),
                        DropdownMenuItem(value: true, child: Text('Yes, Wound Detected')),
                        DropdownMenuItem(value: false, child: Text('No Wound Detected')),
                      ],
                      onChanged: (val) {
                        setState(() => overrideWoundDetected = val);
                      },
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: notesController,
                      maxLines: 3,
                      decoration: const InputDecoration(
                        labelText: 'Clinical Conclusion / Notes',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: () {
                    Navigator.of(ctx).pop();
                    _submitVerification(assessment, overrideWoundDetected, notesController.text);
                  },
                  child: const Text('Submit Verification'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _submitVerification(AssessmentModel assessment, bool? woundDetected, String notes) async {
    setState(() => _isVerifying = true);
    try {
      final service = ref.read(assessmentServiceProvider);
      await service.verifyAssessment(assessment.id, {
        'woundDetected': woundDetected ?? assessment.woundDetected,
        'notes': notes,
        'timestamp': DateTime.now().toIso8601String(),
      });
      
      // Refresh the assessments list to pull the VERIFIED status
      ref.invalidate(assessmentsProvider(assessment.woundId));
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Assessment verified successfully.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to verify: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isVerifying = false);
    }
  }

  Widget _buildVerifiedResultSection(AssessmentModel assessment) {
    final v = assessment.verifiedResult!;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: Colors.green.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.green.shade200, width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.verified, color: Colors.green),
              const SizedBox(width: 8),
              Text(
                'Doctor\'s Verified Conclusions',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.green.shade800),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _MeasurementRow(label: 'Wound Detected', value: v['woundDetected'] == true ? 'Yes' : 'No'),
          if (v['notes'] != null && v['notes'].toString().isNotEmpty)
            _MeasurementRow(label: 'Doctor Notes', value: v['notes']),
          if (v['timestamp'] != null)
            _MeasurementRow(
              label: 'Verified On', 
              value: DateTime.parse(v['timestamp']).toLocal().toString().split('.')[0],
            ),
        ],
      ),
    );
  }
}

class _MeasurementRow extends StatelessWidget {
  final String label;
  final String value;
  
  const _MeasurementRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 2,
            child: Text(label, style: TextStyle(color: Colors.grey.shade600, fontWeight: FontWeight.w500)),
          ),
          Expanded(
            flex: 3,
            child: Text(value, style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
          ),
        ],
      ),
    );
  }
}

class _AuthenticatedImage extends StatefulWidget {
  final String imageUrl;

  const _AuthenticatedImage({required this.imageUrl});

  @override
  State<_AuthenticatedImage> createState() => _AuthenticatedImageState();
}

class _AuthenticatedImageState extends State<_AuthenticatedImage> {
  Uint8List? _bytes;
  bool _isLoading = true;
  bool _hasError = false;

  @override
  void initState() {
    super.initState();
    _loadImage();
  }

  Future<void> _loadImage() async {
    try {
      final dio = await DioClient.getInstance();
      final response = await dio.get(
        widget.imageUrl,
        options: Options(responseType: ResponseType.bytes),
      );
      if (mounted) {
        setState(() {
          _bytes = response.data;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _hasError = true;
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Container(
        height: 250,
        width: double.infinity,
        color: Colors.grey.shade100,
        child: const Center(
          child: CircularProgressIndicator(color: Color(0xFF0D9488)),
        ),
      );
    }

    if (_hasError || _bytes == null) {
      return Container(
        height: 250,
        width: double.infinity,
        color: Colors.grey.shade100,
        child: const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.broken_image, color: Colors.grey, size: 48),
              SizedBox(height: 8),
              Text('Failed to load image', style: TextStyle(color: Colors.grey)),
            ],
          ),
        ),
      );
    }

    return Image.memory(
      _bytes!,
      fit: BoxFit.cover,
      width: double.infinity,
    );
  }
}
