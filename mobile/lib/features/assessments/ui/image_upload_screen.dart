import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter/foundation.dart';
import 'package:image/image.dart' as img;
import 'package:path_provider/path_provider.dart';

import '../../wounds/models/wound_model.dart';
import '../providers/assessment_provider.dart';

class ImageUploadScreen extends ConsumerStatefulWidget {
  final WoundModel wound;
  const ImageUploadScreen({super.key, required this.wound});

  @override
  ConsumerState<ImageUploadScreen> createState() => _ImageUploadScreenState();
}

class _ImageUploadScreenState extends ConsumerState<ImageUploadScreen> {
  File? _selectedImage;
  bool _isUploading = false;
  String? _errorMessage;
  final ImagePicker _picker = ImagePicker();

  Future<void> _pickImage(ImageSource source) async {
    try {
      setState(() {
        _isUploading = true;
        _errorMessage = null;
      });

      final XFile? pickedFile = await _picker.pickImage(
        source: source,
      );

      if (pickedFile != null) {
        final File originalFile = File(pickedFile.path);
        final File normalizedFile = await _normalizeImage(originalFile);

        setState(() {
          _selectedImage = normalizedFile;
          _isUploading = false;
        });
      } else {
        setState(() {
          _isUploading = false;
        });
      }
    } catch (e) {
      setState(() {
        _isUploading = false;
        _errorMessage = 'Failed to pick/process image: ${e.toString().replaceAll('Exception: ', '')}';
      });
    }
  }

  Future<File> _normalizeImage(File originalFile) async {
    final bytes = await originalFile.readAsBytes();
    final Uint8List normalizedBytes = await compute(_processImageBytes, bytes);
    
    final tempDir = await getTemporaryDirectory();
    final tempPath = '${tempDir.path}/normalized_${DateTime.now().millisecondsSinceEpoch}.jpg';
    final normalizedFile = File(tempPath);
    await normalizedFile.writeAsBytes(normalizedBytes);
    
    return normalizedFile;
  }

  static Uint8List _processImageBytes(Uint8List bytes) {
    img.Image? image = img.decodeImage(bytes);
    if (image == null) throw Exception('Failed to decode image');

    image = img.bakeOrientation(image);

    const int maxSize = 4096;
    if (image.width > maxSize || image.height > maxSize) {
      if (image.width > image.height) {
        image = img.copyResize(image, width: maxSize);
      } else {
        image = img.copyResize(image, height: maxSize);
      }
    }

    // Force flatten alpha to black if necessary by compositing over black background
    if (image.hasAlpha) {
      final flattened = img.Image(width: image.width, height: image.height, numChannels: 3);
      img.compositeImage(flattened, image);
      image = flattened;
    }

    final jpgBytes = img.encodeJpg(image, quality: 90);
    return Uint8List.fromList(jpgBytes);
  }

  Future<void> _uploadAndAnalyze() async {
    if (_selectedImage == null) return;

    setState(() {
      _isUploading = true;
      _errorMessage = null;
    });

    try {
      final service = ref.read(assessmentServiceProvider);
      final newAssessment = await service.uploadWoundImage(widget.wound.id, _selectedImage!);

      ref.invalidate(assessmentsProvider(widget.wound.id));
      
      if (mounted) {
        // Navigate to the assessment detail screen, replacing the upload screen
        context.pushReplacement('/assessments/${newAssessment.id}', extra: newAssessment);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isUploading = false;
          _errorMessage = e.toString().replaceAll('Exception: ', '');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Analyze Wound'),
      ),
      body: Stack(
        children: [
          SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Select an image to analyze for Wound ID',
                  style: TextStyle(fontSize: 16, color: Colors.black87),
                  textAlign: TextAlign.center,
                ),
                Text(
                  '#${widget.wound.id} - ${widget.wound.location}',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),
                if (_selectedImage == null) ...[
                  _buildEmptyState(),
                ] else ...[
                  _buildImagePreview(),
                ],
                if (_errorMessage != null) ...[
                  const SizedBox(height: 24),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.red.shade200),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.error_outline, color: Colors.red.shade700),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            _errorMessage!,
                            style: TextStyle(color: Colors.red.shade700),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (_isUploading)
            Container(
              color: Colors.black54,
              child: const Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    CircularProgressIndicator(color: Colors.white),
                    SizedBox(height: 24),
                    Text(
                      'Uploading & Analyzing...',
                      style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Please do not close this screen.',
                      style: TextStyle(color: Colors.white70, fontSize: 14),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Column(
      children: [
        Container(
          height: 250,
          width: double.infinity,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.shade300, style: BorderStyle.solid),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.add_photo_alternate_outlined, size: 64, color: Colors.grey.shade400),
              const SizedBox(height: 16),
              const Text('No image selected', style: TextStyle(color: Colors.black54)),
            ],
          ),
        ),
        const SizedBox(height: 32),
        Row(
          children: [
            Expanded(
              child: ElevatedButton.icon(
                onPressed: _isUploading ? null : () => _pickImage(ImageSource.camera),
                icon: const Icon(Icons.camera_alt),
                label: const Text('Camera'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _isUploading ? null : () => _pickImage(ImageSource.gallery),
                icon: const Icon(Icons.photo_library),
                label: const Text('Gallery'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildImagePreview() {
    return Column(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Image.file(
            _selectedImage!,
            height: 300,
            width: double.infinity,
            fit: BoxFit.cover,
          ),
        ),
        const SizedBox(height: 24),
        Row(
          children: [
            Expanded(
              flex: 1,
              child: OutlinedButton(
                onPressed: _isUploading
                    ? null
                    : () {
                        setState(() {
                          _selectedImage = null;
                          _errorMessage = null;
                        });
                      },
                style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
                child: const Text('Clear'),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              flex: 2,
              child: ElevatedButton.icon(
                onPressed: _isUploading ? null : _uploadAndAnalyze,
                icon: const Icon(Icons.analytics),
                label: const Text('Start Analysis'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  backgroundColor: const Color(0xFF0D9488),
                  foregroundColor: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
