import 'dart:io';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/foundation.dart';
import 'package:image/image.dart' as img;
import 'package:path_provider/path_provider.dart';

import '../models/wound_model.dart';
import '../models/tissue_model.dart';
import '../services/tissue_service.dart';

class TissueAnalysisScreen extends StatefulWidget {
  final WoundModel wound;
  const TissueAnalysisScreen({super.key, required this.wound});

  @override
  State<TissueAnalysisScreen> createState() => _TissueAnalysisScreenState();
}

class _TissueAnalysisScreenState extends State<TissueAnalysisScreen> {
  File? _selectedImage;
  bool _isUploading = false;
  String? _errorMessage;
  AnalyzeTissueResponse? _response;
  
  final ImagePicker _picker = ImagePicker();
  final TissueService _tissueService = TissueService();

  Future<void> _pickImage(ImageSource source) async {
    try {
      setState(() {
        _isUploading = true;
        _errorMessage = null;
        _response = null;
      });

      final XFile? pickedFile = await _picker.pickImage(source: source);

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
      final result = await _tissueService.analyzeTissue(_selectedImage!);
      setState(() {
        _response = result;
        _isUploading = false;
      });
    } catch (e) {
      setState(() {
        _isUploading = false;
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Tissue Analysis'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Tissue Analysis for Wound #${widget.wound.id}',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            if (_selectedImage == null) ...[
              ElevatedButton.icon(
                onPressed: () => _pickImage(ImageSource.camera),
                icon: const Icon(Icons.camera_alt),
                label: const Text('Take a Photo'),
                style: ElevatedButton.styleFrom(padding: const EdgeInsets.all(16)),
              ),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: () => _pickImage(ImageSource.gallery),
                icon: const Icon(Icons.photo_library),
                label: const Text('Choose from Gallery'),
                style: OutlinedButton.styleFrom(padding: const EdgeInsets.all(16)),
              ),
            ] else ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.file(_selectedImage!, height: 300, fit: BoxFit.cover),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _isUploading ? null : () => setState(() {
                        _selectedImage = null;
                        _response = null;
                        _errorMessage = null;
                      }),
                      child: const Text('Retake'),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _isUploading || _response != null ? null : _uploadAndAnalyze,
                      child: _isUploading 
                          ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Text('Analyze Tissue'),
                    ),
                  ),
                ],
              ),
            ],
            if (_errorMessage != null) ...[
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
                child: Row(
                  children: [
                    Icon(Icons.error_outline, color: Colors.red.shade700),
                    const SizedBox(width: 12),
                    Expanded(child: Text(_errorMessage!, style: TextStyle(color: Colors.red.shade900))),
                  ],
                ),
              ),
            ],
            if (_response != null) _buildResults(),
          ],
        ),
      ),
    );
  }

  Widget _buildResults() {
    final comp = _response!.tissueComposition;
    final total = comp.epithelial + comp.granulation + comp.slough + comp.necrotic + comp.fibrin + comp.callus + comp.other;
    
    ImageProvider? annotatedImage;
    if (_response!.annotatedImageBase64 != null) {
      String b64 = _response!.annotatedImageBase64!;
      if (b64.contains(',')) b64 = b64.split(',').last;
      annotatedImage = MemoryImage(base64Decode(b64));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 32),
        const Text('Analysis Results', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.blue.shade200)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.info_outline, color: Colors.blue.shade700),
                  const SizedBox(width: 8),
                  const Expanded(child: Text('Clinical Disclaimer', style: TextStyle(fontWeight: FontWeight.bold))),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'AI-generated tissue composition estimates. These results are not a clinical diagnosis or treatment recommendation.',
                style: TextStyle(color: Colors.blue.shade900, fontSize: 13),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        if (annotatedImage != null) ...[
          const Text('AI-estimated tissue composition map:', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image(image: annotatedImage, height: 300, fit: BoxFit.cover),
          ),
          const SizedBox(height: 24),
        ],
        if (total > 0) SizedBox(
          height: 250,
          child: PieChart(
            PieChartData(
              sectionsSpace: 2,
              centerSpaceRadius: 50,
              sections: [
                if (comp.epithelial > 0) PieChartSectionData(value: comp.epithelial, title: '${comp.epithelial.toStringAsFixed(1)}%', color: Colors.pink.shade200, radius: 60),
                if (comp.granulation > 0) PieChartSectionData(value: comp.granulation, title: '${comp.granulation.toStringAsFixed(1)}%', color: Colors.red.shade600, radius: 60),
                if (comp.slough > 0) PieChartSectionData(value: comp.slough, title: '${comp.slough.toStringAsFixed(1)}%', color: Colors.yellow.shade600, radius: 60),
                if (comp.necrotic > 0) PieChartSectionData(value: comp.necrotic, title: '${comp.necrotic.toStringAsFixed(1)}%', color: Colors.black87, titleStyle: const TextStyle(color: Colors.white), radius: 60),
                if (comp.fibrin > 0) PieChartSectionData(value: comp.fibrin, title: '${comp.fibrin.toStringAsFixed(1)}%', color: Colors.yellow.shade400, radius: 60),
                if (comp.callus > 0) PieChartSectionData(value: comp.callus, title: '${comp.callus.toStringAsFixed(1)}%', color: Colors.grey.shade300, radius: 60),
                if (comp.other > 0) PieChartSectionData(value: comp.other, title: '${comp.other.toStringAsFixed(1)}%', color: Colors.grey, radius: 60),
              ],
            ),
          ),
        ) else
          const Center(child: Padding(padding: EdgeInsets.all(24.0), child: Text('No wound tissue detected in the image.'))),
        const SizedBox(height: 24),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              children: [
                _buildLegendItem('Epithelial', comp.epithelial, Colors.pink.shade200),
                _buildLegendItem('Granulation', comp.granulation, Colors.red.shade600),
                _buildLegendItem('Slough', comp.slough, Colors.yellow.shade600),
                _buildLegendItem('Necrotic', comp.necrotic, Colors.black87),
                _buildLegendItem('Fibrin', comp.fibrin, Colors.yellow.shade400),
                _buildLegendItem('Callus', comp.callus, Colors.grey.shade300),
                _buildLegendItem('Other', comp.other, Colors.grey),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLegendItem(String label, double value, Color color) {
    if (value <= 0) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        children: [
          Container(width: 16, height: 16, color: color),
          const SizedBox(width: 8),
          Expanded(child: Text(label)),
          Text('${value.toStringAsFixed(1)}%', style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
