# 9. Image Processing and Segmentation

Since the U-Net and YOLO ML models are currently stubbed, the image processing pipeline relies heavily on deterministic computer vision techniques via the `OpenCV` (`cv2`) library.

## Detection and Masking Process

1. **Color Space Conversion**: The image is converted from BGR (OpenCV default) to HSV (Hue, Saturation, Value) to isolate colors independent of lighting intensity.
2. **Thresholding**: The `YoloDetector` stub targets ranges consistent with wound tissue (reds and dark hues).
3. **Morphological Operations**: 
   - A closing operation (`cv2.morphologyEx` with `cv2.MORPH_CLOSE`) is used to fill small holes inside the thresholded regions.
   - An opening operation removes small scattered noise.
4. **Contour Extraction**: `cv2.findContours` locates the boundaries of the remaining continuous shapes. The largest contour is assumed to be the wound.
5. **Bounding Box**: A bounding rectangle (`cv2.boundingRect`) is drawn around the selected contour.
6. **Mask Generation**: A binary mask is created, assigning a value of `255` (white) to pixels inside the contour, and `0` (black) to everything else.

## Mathematical Measurement Calculations

The `WoundMeasurements` service translates the generated mask into physical data.

### 1. Pixel Area
The exact pixel area is calculated using:
```python
pixel_area = cv2.contourArea(contour)
```

### 2. Physical Area (cm²)
If the image was successfully calibrated to determine `pixels_per_cm`:
```python
pixels_per_cm2 = pixels_per_cm * pixels_per_cm
physical_area_cm2 = pixel_area / pixels_per_cm2
```

### 3. Physical Dimensions (Length & Width)
The bounding rectangle (`w`, `h` in pixels) is divided by the `pixels_per_cm` scale to extract physical length and width in cm.

### Image Annotation
The pipeline utilizes `cv2.drawContours` and `cv2.rectangle` to visually overlay the generated mask and bounding box onto the original image, ensuring the clinician can visually verify exactly what the algorithm calculated.
